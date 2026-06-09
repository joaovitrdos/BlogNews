package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	anthropicURL     = "https://api.anthropic.com/v1/messages"
	anthropicVersion = "2023-06-01"
	maxKeywords      = 5
	claudeMaxTokens  = 400
	claudeTimeout    = 20 * time.Second
)

var validCategories = []string{
	"Política", "Economia", "Tecnologia", "Saúde", "Educação",
	"Esporte", "Mundo", "Entretenimento", "Ciência", "Geral",
}

type EnrichedData struct {
	AISummary  string
	AIKeywords []string
	Category   string
}

type claudeService struct {
	apiKey string
	model  string
	client *http.Client
}

type claudeRequest struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	Messages  []message `json:"messages"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

type aiResult struct {
	Summary  string   `json:"summary"`
	Keywords []string `json:"keywords"`
	Category string   `json:"category"`
}

func newClaudeService(apiKey, model string, client *http.Client) *claudeService {
	return &claudeService{apiKey: apiKey, model: model, client: client}
}

func (cs *claudeService) enrich(title, originalSummary string) EnrichedData {
	fallback := EnrichedData{
		AISummary:  originalSummary,
		AIKeywords: []string{},
		Category:   "Geral",
	}

	if cs.apiKey == "" {
		return fallback
	}

	prompt := fmt.Sprintf(
		`Você é um editor de um portal de notícias brasileiro. Analise a notícia abaixo e retorne um JSON válido.

Título: %s
Descrição original: %s

Retorne APENAS um JSON com este formato (sem markdown, sem explicações):
{
  "summary": "resumo claro e objetivo em 2-3 frases em português",
  "keywords": ["palavra1", "palavra2", "palavra3"],
  "category": "uma das categorias: %s"
}`,
		title,
		coalesce(originalSummary, "(sem descrição)"),
		strings.Join(validCategories, ", "),
	)

	body, err := json.Marshal(claudeRequest{
		Model:     cs.model,
		MaxTokens: claudeMaxTokens,
		Messages:  []message{{Role: "user", Content: prompt}},
	})
	if err != nil {
		return fallback
	}

	ctx, cancel := context.WithTimeout(context.Background(), claudeTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, anthropicURL, bytes.NewReader(body))
	if err != nil {
		return fallback
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cs.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := cs.client.Do(req)
	if err != nil {
		return fallback
	}
	defer resp.Body.Close()

	var cr claudeResponse
	if err := json.NewDecoder(resp.Body).Decode(&cr); err != nil {
		return fallback
	}

	if cr.Error != nil || len(cr.Content) == 0 {
		return fallback
	}

	raw := strings.TrimSpace(cr.Content[0].Text)
	if strings.HasPrefix(raw, "```") {
		lines := strings.Split(raw, "\n")
		end := len(lines) - 1
		if strings.HasPrefix(lines[end], "```") {
			end--
		}
		if len(lines) > 1 {
			raw = strings.Join(lines[1:end+1], "\n")
		}
	}

	var result aiResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return fallback
	}

	category := "Geral"
	for _, c := range validCategories {
		if c == result.Category {
			category = c
			break
		}
	}

	kw := result.Keywords
	if len(kw) > maxKeywords {
		kw = kw[:maxKeywords]
	}
	if kw == nil {
		kw = []string{}
	}

	return EnrichedData{
		AISummary:  coalesce(result.Summary, originalSummary),
		AIKeywords: kw,
		Category:   category,
	}
}

func coalesce(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}
