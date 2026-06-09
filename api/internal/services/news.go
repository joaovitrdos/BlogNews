package services

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"blognews/internal/models"
)

type NewsService struct {
	db     *pgxpool.Pool
	claude *claudeService
	http   *http.Client
}

func NewNewsService(db *pgxpool.Pool, anthropicKey, claudeModel string) *NewsService {
	shared := &http.Client{Timeout: 25 * time.Second}
	return &NewsService{
		db:     db,
		claude: newClaudeService(anthropicKey, claudeModel, shared),
		http:   &http.Client{Timeout: rssTimeout},
	}
}

func (s *NewsService) FetchAndSave() (models.FetchResult, error) {
	articles := fetchG1Articles(s.http)
	result := models.FetchResult{Total: len(articles)}

	for _, a := range articles {
		if a.URL == "" || a.Title == "" {
			result.Skipped++
			continue
		}

		var exists bool
		if err := s.db.QueryRow(context.Background(),
			"SELECT EXISTS(SELECT 1 FROM news WHERE url = $1)", a.URL,
		).Scan(&exists); err != nil {
			result.Skipped++
			continue
		}
		if exists {
			result.Skipped++
			continue
		}

		enriched := s.claude.enrich(a.Title, a.Summary)

		var imageURL *string
		if a.ImageURL != "" {
			imageURL = &a.ImageURL
		}

		if _, err := s.db.Exec(context.Background(), `
			INSERT INTO news
				(title, summary, url, source, category, image_url, published_at, ai_summary, ai_keywords)
			VALUES
				($1, $2, $3, $4, $5, $6, $7, $8, $9)
			ON CONFLICT (url) DO NOTHING`,
			a.Title, a.Summary, a.URL, a.Source,
			enriched.Category, imageURL, a.PublishedAt,
			enriched.AISummary, enriched.AIKeywords,
		); err != nil {
			continue
		}
		result.Saved++
	}

	result.Message = "Fetch concluído"
	return result, nil
}

func (s *NewsService) List(limit, offset int, category string) (models.NewsListResponse, error) {
	ctx := context.Background()

	const selectCols = `
		SELECT id, title,
		       COALESCE(NULLIF(ai_summary,''), NULLIF(summary,''), '') AS summary,
		       url, source, category, image_url, published_at,
		       COALESCE(ai_keywords, '{}') AS keywords, created_at
		FROM news`

	var (
		total int
		rows  pgx.Rows
		err   error
	)

	if category != "" {
		if err = s.db.QueryRow(ctx,
			"SELECT COUNT(*) FROM news WHERE category = $1", category,
		).Scan(&total); err != nil {
			return models.NewsListResponse{}, fmt.Errorf("count por categoria: %w", err)
		}
		rows, err = s.db.Query(ctx,
			selectCols+` WHERE category = $1 ORDER BY published_at DESC, created_at DESC LIMIT $2 OFFSET $3`,
			category, limit, offset,
		)
	} else {
		if err = s.db.QueryRow(ctx, "SELECT COUNT(*) FROM news").Scan(&total); err != nil {
			return models.NewsListResponse{}, fmt.Errorf("count total: %w", err)
		}
		rows, err = s.db.Query(ctx,
			selectCols+` ORDER BY published_at DESC, created_at DESC LIMIT $1 OFFSET $2`,
			limit, offset,
		)
	}

	if err != nil {
		return models.NewsListResponse{}, fmt.Errorf("query list: %w", err)
	}
	defer rows.Close()

	return models.NewsListResponse{News: scanNews(rows), Total: total}, nil
}

func (s *NewsService) Latest(n int) ([]models.News, error) {
	rows, err := s.db.Query(context.Background(), `
		SELECT id, title,
		       COALESCE(NULLIF(ai_summary,''), NULLIF(summary,''), '') AS summary,
		       url, source, category, image_url, published_at,
		       COALESCE(ai_keywords, '{}') AS keywords, created_at
		FROM news
		ORDER BY published_at DESC, created_at DESC
		LIMIT $1`, n)
	if err != nil {
		return nil, fmt.Errorf("query latest: %w", err)
	}
	defer rows.Close()

	return scanNews(rows), nil
}

func (s *NewsService) GetByID(id string) (*models.News, error) {
	var n models.News
	err := s.db.QueryRow(context.Background(), `
		SELECT id, title,
		       COALESCE(summary, '')    AS summary,
		       COALESCE(ai_summary, '') AS ai_summary,
		       url, source, category, image_url, published_at,
		       COALESCE(ai_keywords, '{}') AS keywords, created_at
		FROM news
		WHERE id = $1`, id,
	).Scan(
		&n.ID, &n.Title, &n.Summary, &n.AISummary,
		&n.URL, &n.Source, &n.Category,
		&n.ImageURL, &n.PublishedAt,
		&n.Keywords, &n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	n.NormalizeKeywords()
	return &n, nil
}

func (s *NewsService) Categories() ([]models.Category, error) {
	rows, err := s.db.Query(context.Background(), `
		SELECT category, COUNT(*) AS count
		FROM news
		GROUP BY category
		ORDER BY count DESC`)
	if err != nil {
		return nil, fmt.Errorf("query categories: %w", err)
	}
	defer rows.Close()

	var cats []models.Category
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.Category, &c.Count); err != nil {
			continue
		}
		cats = append(cats, c)
	}
	return cats, nil
}

func (s *NewsService) HasNews() bool {
	var count int
	if err := s.db.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM news",
	).Scan(&count); err != nil {
		return false
	}
	return count > 0
}

func scanNews(rows pgx.Rows) []models.News {
	newsList := make([]models.News, 0)
	for rows.Next() {
		var n models.News
		if err := rows.Scan(
			&n.ID, &n.Title, &n.Summary,
			&n.URL, &n.Source, &n.Category,
			&n.ImageURL, &n.PublishedAt,
			&n.Keywords, &n.CreatedAt,
		); err != nil {
			continue
		}
		n.NormalizeKeywords()
		newsList = append(newsList, n)
	}
	return newsList
}
