# Manual Técnico — BlogNews

**Stack:** React 18 + Vite + Tailwind (porta 85) · Go 1.22 + chi (porta 3001) · PostgreSQL 16 (porta 5432) · Docker Compose · Claude API (Anthropic)

### Arquitetura

```
[Usuário] → Nginx:85 → React SPA
                 ↓ proxy /api/
            API Go:3001 ← Cron 10h/18h
                 ↓ pgx pool
            PostgreSQL:5432

API Go → G1 RSS Feeds (8 goroutines paralelas)
       → Anthropic Claude API (enriquecimento)
```

### Variáveis de Ambiente (`.env`)

| Variável | Obrig. | Default | Descrição |
|----------|--------|---------|-----------|
| `POSTGRES_DB` | ✅ | `blognews` | Nome do banco |
| `POSTGRES_USER` | ✅ | `blognews` | Usuário PostgreSQL |
| `POSTGRES_PASSWORD` | ✅ | — | Senha PostgreSQL |
| `ANTHROPIC_API_KEY` | ✅ | — | Chave da API Claude |
| `API_SECRET_KEY` | ✅ | — | Chave do endpoint `/fetch` |
| `PORT` | ❌ | `3001` | Porta da API |
| `TZ` | ❌ | `America/Sao_Paulo` | Fuso horário do cron |
| `CRON_SCHEDULE_MORNING` | ❌ | `0 10 * * *` | Horário do fetch matinal |
| `CRON_SCHEDULE_EVENING` | ❌ | `0 18 * * *` | Horário do fetch noturno |
| `CLAUDE_MODEL` | ❌ | `claude-haiku-4-5-20251001` | Modelo Claude |
| `CORS_ORIGIN` | ❌ | `*` | Origens permitidas |

### Deploy

```bash
cp .env.example .env      # preencher com valores reais
docker compose up -d      # subir todos os serviços
docker compose ps         # verificar status
docker compose logs -f    # acompanhar logs
```

Após subir: frontend em `http://localhost:85`, API em `http://localhost:3001`.

### Sequência de inicialização da API
1. Carrega config via env vars
2. Cria pool de conexões PostgreSQL (max 10, min 2)
3. Executa migrations automáticas (`CREATE TABLE IF NOT EXISTS`)
4. Inicia scheduler cron (2 jobs)
5. Se banco vazio → dispara fetch inicial após 2s
6. Sobe servidor HTTP com graceful shutdown (SIGINT/SIGTERM)

### Fluxo de fetch
```
Cron dispara → fetchG1Articles() → 8 goroutines buscam feeds RSS em paralelo
→ Para cada artigo: verifica duplicata por URL no DB
→ Se novo: claude.enrich(title, summary) → categoria + resumo IA + keywords
→ INSERT INTO news ... ON CONFLICT (url) DO NOTHING
```

### Segurança
- Queries parametrizadas (`$1, $2…`) — sem SQL injection
- `subtle.ConstantTimeCompare` na validação da API Key — sem timing attack
- `clamp()` nos parâmetros de paginação — sem overflow
- Validação de UUID antes de consultar — sem buscas desnecessárias
- `io.LimitReader` nos feeds RSS — máximo 2 MB por feed
- Timeouts: 25s Claude · 12s RSS · 30s HTTP geral

### Manutenção

```bash
# Fetch manual
curl -X POST http://localhost:3001/api/v1/news/fetch -H "x-api-key: SUA_CHAVE"

# Backup
docker exec blognews_postgres pg_dump -U blognews blognews > backup.sql

# Restaurar
docker exec -i blognews_postgres psql -U blognews blognews < backup.sql

# Acessar banco
docker exec -it blognews_postgres psql -U blognews blognews

# Limpar notícias antigas
DELETE FROM news WHERE created_at < NOW() - INTERVAL '30 days';
```

### Dependências principais

| Camada | Pacote | Versão | Uso |
|--------|--------|--------|-----|
| Backend | `go-chi/chi` | v5.1.0 | Router HTTP |
| Backend | `jackc/pgx/v5` | v5.6.0 | Driver PostgreSQL |
| Backend | `robfig/cron` | v3.0.1 | Agendamento |
| Frontend | `react` | ^18.3.1 | UI |
| Frontend | `react-router-dom` | ^6.24.0 | Roteamento SPA |
| Frontend | `vite` | ^5.3.1 | Build tool |
| Frontend | `tailwindcss` | ^3.4.4 | CSS |

---

## 3. APIs Usadas

### 3.1 API Interna (REST — Go)

Base URL: `http://localhost:3001`

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| GET | `/health` | — | Status da aplicação e do banco |
| GET | `/api/v1/news/` | — | Lista paginada de notícias |
| GET | `/api/v1/news/latest` | — | N notícias mais recentes |
| GET | `/api/v1/news/categories` | — | Categorias com contagem |
| GET | `/api/v1/news/{id}` | — | Detalhe completo de uma notícia |
| POST | `/api/v1/news/fetch` | `x-api-key` | Dispara busca manual no G1 |

#### Parâmetros dos principais endpoints

**`GET /api/v1/news/`**

| Param | Tipo | Default | Limite | Descrição |
|-------|------|---------|--------|-----------|
| `limit` | int | 20 | 1–100 | Itens por página |
| `offset` | int | 0 | ≥0 | Itens a pular |
| `category` | string | — | 100 chars | Filtro de categoria |

**`GET /api/v1/news/latest`**

| Param | Tipo | Default | Limite |
|-------|------|---------|--------|
| `n` | int | 6 | 1–20 |

#### Objeto News (resposta)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Câmara aprova regulamentação da IA",
  "summary": "Resumo IA (ou original se IA indisponível)",
  "ai_summary": "Resumo da IA — apenas em /news/{id}",
  "url": "https://g1.globo.com/...",
  "source": "G1",
  "category": "Política",
  "image_url": "https://s2.glbimg.com/...",
  "published_at": "2026-05-26T14:00:00Z",
  "keywords": ["câmara", "IA", "lei"],
  "created_at": "2026-05-26T14:05:10Z"
}
```

> `ai_summary` só é retornado em `GET /api/v1/news/{id}`. Nas listagens, `summary` já traz o melhor disponível (IA › original › vazio).

#### Respostas de erro

```json
{ "error": "Mensagem descritiva" }
```
Códigos: `400` parâmetro inválido · `401` sem API Key · `404` não encontrado · `500` erro interno · `503` banco inacessível

#### Exemplos cURL

```bash
# Health
curl http://localhost:3001/health

# Últimas 9 notícias
curl "http://localhost:3001/api/v1/news/latest?n=9"

# Página 2 de Tecnologia
curl "http://localhost:3001/api/v1/news/?limit=18&offset=18&category=Tecnologia"

# Detalhe
curl "http://localhost:3001/api/v1/news/550e8400-e29b-41d4-a716-446655440000"

# Fetch manual
curl -X POST http://localhost:3001/api/v1/news/fetch -H "x-api-key: SUA_CHAVE"
```

---

### 3.2 API G1 — RSS Feeds (externa)

Feeds consumidos em paralelo (8 goroutines, até 10 itens por feed, timeout 12s):

| Feed | URL RSS | Categoria |
|------|---------|-----------|
| Geral | `https://g1.globo.com/rss/g1/` | Geral |
| Política | `https://g1.globo.com/rss/g1/politica/` | Política |
| Economia | `https://g1.globo.com/rss/g1/economia/` | Economia |
| Tecnologia | `https://g1.globo.com/rss/g1/tecnologia/` | Tecnologia |
| Saúde | `https://g1.globo.com/rss/g1/saude/` | Saúde |
| Educação | `https://g1.globo.com/rss/g1/educacao/` | Educação |
| Esporte | `https://g1.globo.com/rss/g1/esporte/` | Esporte |
| Mundo | `https://g1.globo.com/rss/g1/mundo/` | Mundo |

Campos extraídos do XML: `<title>`, `<link>`, `<description>`, `<pubDate>`, `<enclosure url>`, `<media:content url>`, `<content:encoded>` (para imagem fallback).

---

### 3.3 API Claude — Anthropic (externa)

| Atributo | Valor |
|----------|-------|
| Endpoint | `https://api.anthropic.com/v1/messages` |
| Versão | `2023-06-01` |
| Modelo default | `claude-haiku-4-5-20251001` |
| Max tokens | 400 |
| Timeout | 20s |
| Autenticação | Header `x-api-key: <ANTHROPIC_API_KEY>` |

**Prompt enviado para cada notícia:**
> "Analise a notícia e retorne JSON com: `summary` (2-3 frases em pt-BR), `keywords` (até 5), `category` (uma de: Política, Economia, Tecnologia, Saúde, Educação, Esporte, Mundo, Entretenimento, Ciência, Geral)"

**Se a IA falhar** (sem chave, timeout, JSON inválido): usa resumo original do G1, `keywords: []` e `category: "Geral"` como fallback.

---

## 4. Modelo do Banco de Dados

### Schema — Tabela `news`

```sql
CREATE TABLE IF NOT EXISTS news (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(500) NOT NULL,
    summary      TEXT,
    url          TEXT         UNIQUE NOT NULL,
    source       VARCHAR(100) DEFAULT 'G1',
    category     VARCHAR(100) DEFAULT 'Geral',
    image_url    TEXT,
    published_at TIMESTAMPTZ,
    ai_summary   TEXT,
    ai_keywords  TEXT[]       DEFAULT '{}',
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_created_at   ON news (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category     ON news (category);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news (published_at DESC);
```

### Colunas

| Coluna | Tipo | Nulo | Descrição |
|--------|------|------|-----------|
| `id` | UUID | Não | PK gerada automaticamente pelo PostgreSQL |
| `title` | VARCHAR(500) | Não | Título original do RSS |
| `summary` | TEXT | Sim | Descrição original do G1 |
| `url` | TEXT UNIQUE | Não | URL canônica — chave de deduplicação |
| `source` | VARCHAR(100) | Sim | Fonte (sempre `"G1"`) |
| `category` | VARCHAR(100) | Sim | Categoria atribuída pela IA |
| `image_url` | TEXT | Sim | URL da imagem (`NULL` quando ausente) |
| `published_at` | TIMESTAMPTZ | Sim | Data de publicação no G1 |
| `ai_summary` | TEXT | Sim | Resumo gerado pela IA (`NULL` se indisponível) |
| `ai_keywords` | TEXT[] | Sim | Array de até 5 palavras-chave (default `{}`) |
| `created_at` | TIMESTAMPTZ | Sim | Timestamp de inserção — preenchido por `NOW()` |

### Índices

| Índice | Coluna | Uso |
|--------|--------|-----|
| `idx_news_published_at` | `published_at DESC` | Ordenação principal das listagens |
| `idx_news_category` | `category` | Filtro `WHERE category = $1` |
| `idx_news_created_at` | `created_at DESC` | Desempate de ordenação |

### Consultas principais

```sql
-- Listagem paginada (todas categorias)
SELECT id, title,
       COALESCE(NULLIF(ai_summary,''), NULLIF(summary,''), '') AS summary,
       url, source, category, image_url, published_at,
       COALESCE(ai_keywords, '{}') AS keywords, created_at
FROM news
ORDER BY published_at DESC, created_at DESC
LIMIT $1 OFFSET $2;

-- Detalhe (retorna summary e ai_summary separados)
SELECT id, title,
       COALESCE(summary,'') AS summary,
       COALESCE(ai_summary,'') AS ai_summary,
       url, source, category, image_url, published_at,
       COALESCE(ai_keywords,'{}') AS keywords, created_at
FROM news WHERE id = $1;

-- Categorias com contagem
SELECT category, COUNT(*) AS count
FROM news GROUP BY category ORDER BY count DESC;

-- Inserção com deduplicação automática
INSERT INTO news (title, summary, url, source, category,
                  image_url, published_at, ai_summary, ai_keywords)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
ON CONFLICT (url) DO NOTHING;
```

### Diagrama resumido

```
┌──────────────────────────────────────────────┐
│                    news                       │
├──────────────┬──────────────┬────────────────┤
│ id (PK)      │ UUID         │ auto-gerado    │
│ title        │ VARCHAR(500) │ NOT NULL       │
│ summary      │ TEXT         │ RSS original   │
│ url (UNIQUE) │ TEXT         │ NOT NULL       │
│ source       │ VARCHAR(100) │ default 'G1'   │
│ category     │ VARCHAR(100) │ default 'Geral'│
│ image_url    │ TEXT         │ nullable       │
│ published_at │ TIMESTAMPTZ  │ nullable       │
│ ai_summary   │ TEXT         │ nullable (IA)  │
│ ai_keywords  │ TEXT[]       │ default '{}'   │
│ created_at   │ TIMESTAMPTZ  │ default NOW()  │
└──────────────┴──────────────┴────────────────┘
```


