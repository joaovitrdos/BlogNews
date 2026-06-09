# BlogNews — Como a aplicação funciona (de ponta a ponta)

> Resumo técnico do backend Go: do boot ao shutdown, peça por peça e como tudo se conecta.

## Visão geral

Backend em **Go** que coleta notícias do **G1 (RSS)**, enriquece com a **IA do Claude** e serve via **API REST**. Um **frontend React** consome essa API. Tudo orquestrado em **Docker** (postgres + api + frontend).

```
React (Nginx :85) ──proxy /api/──► API Go :3001 ──pgx──► PostgreSQL :5432
                                        │
                              Cron 10h/18h ──► G1 RSS (8 feeds) + Claude API
```

---

## 1. Onde começa — `cmd/api/main.go` (o `main()`)

A inicialização é uma sequência clara (`cmd/api/main.go:24-101`):

| Passo | Chamada | O que faz |
|------|---------|-----------|
| 1. Carrega config | `config.Load()` | Lê env vars e valida |
| 2. Cria pool do banco | `database.NewPool()` | Conexões pgx (min 2, máx 10) |
| 3. `defer pool.Close()` | — | Garante fechar conexões no fim |
| 4. Migrations | `database.RunMigrations()` | `CREATE TABLE IF NOT EXISTS news` |
| 5. Cria o serviço | `services.NewNewsService()` | Junta DB + Claude + HTTP |
| 6. Liga o scheduler | `scheduler.Start()` | Agenda cron 10h/18h |
| 7. Monta o router | `chi.NewRouter()` + middlewares | Veja §3 |
| 8. Registra rotas | `/health` e `/api/v1/news/*` | Veja §4 |
| 9. **Fetch inicial** | goroutine | Após 2s, se o banco estiver vazio (`!HasNews()`), busca notícias |
| 10. Sobe o servidor | `srv.ListenAndServe()` numa goroutine | Porta 3001 |
| 11. **Espera sinal** | `<-quit` | Bloqueia até SIGINT/SIGTERM |

---

## 2. Configuração — `internal/config/config.go`

Lê variáveis de ambiente com defaults (`config.go:22-33`) e **valida o obrigatório** (`config.go:42-51`):

- **Obrigatórias:** `DATABASE_URL`, `API_SECRET_KEY` → se faltarem, a app **nem sobe** (`os.Exit(1)`).
- **Opcionais (com default):** `PORT` (3001), `TZ` (America/Sao_Paulo), cron 10h/18h, `CLAUDE_MODEL` (claude-haiku-4-5), `CORS_ORIGIN` (`*`) e a `ANTHROPIC_API_KEY` (default vazio → cai no fallback "Geral").

> Atenção operacional: se a `ANTHROPIC_API_KEY` estiver vazia no container, **todas** as notícias são categorizadas como "Geral". Ao editar o `.env`, recrie o container (`docker compose up -d api`) para ele recarregar a variável.

---

## 3. Middlewares (a "esteira" por onde toda requisição passa)

Aplicados nesta ordem em `cmd/api/main.go:48-53`:

| Middleware | Função |
|-----------|--------|
| `RequestID` | Gera um ID único por requisição |
| `RealIP` | Descobre o IP real do cliente |
| `Logger` | Loga método, rota, status e tempo |
| `Recoverer` | Captura `panic` e devolve 500 sem derrubar o servidor |
| `Timeout(30s)` | Cancela requisições que passam de 30s |
| `corsMiddleware` | Headers CORS + responde preflight `OPTIONS` com 204 (`main.go:129`) |

**Middleware customizado de autenticação** — `internal/middleware/auth.go`:

- Só protege o **`POST /fetch`** (`main.go:62`).
- Lê o header `x-api-key` e compara com `subtle.ConstantTimeCompare` (defesa contra *timing attack*). Se inválido → **401** `{"error":"Chave de API inválida"}`.

---

## 4. Handlers (o que cada endpoint faz) — `internal/handlers/news.go`

| Método | Rota | Handler | O que faz |
|--------|------|---------|-----------|
| GET | `/health` | `healthHandler` | Pinga o banco (timeout 3s); 200 ok / 503 se banco fora (`main.go:104`) |
| GET | `/api/v1/news/` | `ListNews` | Lista paginada |
| GET | `/api/v1/news/latest` | `LatestNews` | N mais recentes |
| GET | `/api/v1/news/categories` | `Categories` | Categorias + contagem |
| GET | `/api/v1/news/{id}` | `GetNews` | Detalhe por UUID |
| POST | `/api/v1/news/fetch` | `FetchNews` | Dispara a coleta (protegido) |

**Validações de entrada (helpers):**

- `clamp()` → trava `limit` em 1–100 (default 20) e `offset` em ≥0 (`news.go:78`); `n` do latest em 1–20.
- `category` → `TrimSpace` + máximo 100 chars, senão **400**.
- `isValidUUID()` → valida o formato do ID **antes** de consultar o banco; inválido → **400**; não achou → **404** (`pgx.ErrNoRows`).
- `writeJSON` / `writeError` → padronizam as respostas.

Os handlers são **finos**: só validam e delegam para o **serviço**. Toda a regra de negócio fica na camada de serviço.

---

## 5. Camada de serviço — `internal/services/news.go`

É o **cérebro**. O `NewNewsService` (`news.go:21`) cria **dois clientes HTTP**: um de 25s (para o Claude) e um de 12s (para o RSS).

**`FetchAndSave()`** (`news.go:30`) — o coração da coleta:

```
fetchG1Articles()                  → busca os 8 feeds (ver §6)
para cada artigo:
   ├─ título/URL vazio?  → Skipped++
   ├─ SELECT EXISTS(url) → já existe? Skipped++   (anti-duplicado)
   ├─ claude.enrich()    → resumo + categoria + keywords (ver §7)
   └─ INSERT ... ON CONFLICT (url) DO NOTHING → Saved++
```

> Detalhe importante: o INSERT usa **`enriched.Category`** (a categoria da IA), **não** a categoria do feed. Por isso, sem a chave do Claude, tudo vira "Geral".

Os outros métodos são consultas: `List` (com/sem filtro de categoria + `COUNT`), `Latest`, `GetByID` (traz `summary` e `ai_summary` separados), `Categories` (`GROUP BY`), `HasNews`.

---

## 6. Coleta do G1 — `internal/services/g1.go`

- **8 feeds** mapeados a categorias (`g1.go:23`): Geral, Política, Economia, Tecnologia, Saúde, Educação, Esporte, Mundo.
- **`fetchG1Articles`** (`g1.go:75`): dispara **uma goroutine por feed** (paralelo), junta tudo por um `channel` e **deduplica por URL** entre feeds (mapa `seen`).
- **`parseFeed`**: GET com User-Agent, **`io.LimitReader` (máx 2 MB)**, `xml.Unmarshal`, pega os **10 primeiros** itens. Para cada um monta um `Article`: limpa HTML do resumo, extrai imagem (enclosure → media:content → `<img>` no conteúdo) e converte a data com vários formatos (fallback = agora).

---

## 7. Enriquecimento com IA — `internal/services/claude.go`

- **`enrich(título, resumo)`** (`claude.go:69`): se a chave estiver vazia → **fallback** (resumo original, `[]`, "Geral").
- Monta um prompt pedindo **JSON** com `summary`, `keywords`, `category`; chama `POST https://api.anthropic.com/v1/messages` (`x-api-key`, `anthropic-version`, timeout 20s, modelo claude-haiku-4-5).
- Trata a resposta: remove cercas de markdown, faz `Unmarshal`, **valida a categoria** contra a lista permitida (senão "Geral") e **limita a 5 keywords**.
- **Qualquer erro** (timeout, JSON inválido, sem chave) → fallback, então **nunca quebra** o fetch.

---

## 8. Scheduler — `internal/scheduler/scheduler.go`

- **`Start`** (`scheduler.go:11`): carrega o fuso (`America/Sao_Paulo`, fallback UTC), cria o `cron` e registra **dois jobs** (manhã e noite) que chamam `svc.FetchAndSave()`. Por padrão: **`0 10 * * *`** e **`0 18 * * *`**.

---

## 9. Models — `internal/models/news.go`

Os "contratos" de dados: `News` (com tags JSON — `ai_summary` usa `omitempty`, por isso só aparece no detalhe), `NewsListResponse` (`{news, total}`), `Category` (`{category, count}`), `FetchResult` (`{message, saved, skipped, total}`) e `Article` (modelo interno da coleta).

---

## 10. Onde termina — Graceful shutdown

Em `cmd/api/main.go:87-101`:

1. `signal.Notify` escuta **SIGINT/SIGTERM** (Ctrl+C, `docker stop`).
2. `<-quit` desbloqueia quando o sinal chega.
3. `srv.Shutdown(ctx)` com **timeout de 10s** → para de aceitar novas conexões e deixa as em andamento terminarem.
4. O `defer pool.Close()` fecha o pool do banco.

Ou seja: sobe limpo (config → banco → migrations → serviço → cron → servidor) e **desce limpo** (drena requisições e fecha o banco).

---

## Ciclo de vida de uma requisição (exemplo `POST /fetch`)

```
cliente ─► RequestID ─► RealIP ─► Logger ─► Recoverer ─► Timeout(30s) ─► CORS
       ─► APIKey (x-api-key? senão 401) ─► FetchNews handler
       ─► svc.FetchAndSave() ─► g1.fetchG1Articles (8 goroutines)
                              ─► claude.enrich (por artigo)
                              ─► INSERT ON CONFLICT
       ◄─ 200 {"message","saved","skipped","total"}
```

---

## Pontos de segurança / robustez

- Chave de API com **comparação em tempo constante**.
- **Queries parametrizadas** (`$1, $2…`) → sem SQL injection.
- **Validação de UUID** e **`clamp()`** na paginação.
- **`io.LimitReader` (2 MB)** por feed; **timeouts** em tudo (25s Claude / 12s RSS / 30s HTTP / 3s health).
- **`Recoverer`** + **graceful shutdown** → o servidor não cai por panic nem perde requisições no deploy.
- Fallback da IA → a coleta **nunca quebra**.

---

## Estrutura de pastas (backend)

```
api/
├── cmd/api/main.go              entrypoint: router, middlewares, rotas, shutdown
└── internal/
    ├── config/config.go         carrega e valida env vars
    ├── database/db.go           pool pgx + migrations
    ├── handlers/news.go         ListNews, LatestNews, Categories, GetNews, FetchNews
    ├── middleware/auth.go       APIKey (x-api-key, constant-time)
    ├── models/news.go           structs (News, Article, FetchResult, ...)
    ├── scheduler/scheduler.go   cron 10h/18h
    └── services/
        ├── g1.go                8 feeds RSS em paralelo (goroutines)
        ├── claude.go            Anthropic API (enriquecimento)
        └── news.go              orquestra fetch + enrich + save
```
