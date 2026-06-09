package models

import "time"

type News struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Summary     string     `json:"summary,omitempty"`
	AISummary   string     `json:"ai_summary,omitempty"`
	URL         string     `json:"url"`
	Source      string     `json:"source"`
	Category    string     `json:"category"`
	ImageURL    *string    `json:"image_url"`
	PublishedAt *time.Time `json:"published_at"`
	Keywords    []string   `json:"keywords"`
	CreatedAt   time.Time  `json:"created_at"`
}

func (n *News) NormalizeKeywords() {
	if n.Keywords == nil {
		n.Keywords = []string{}
	}
}

type NewsListResponse struct {
	News  []News `json:"news"`
	Total int    `json:"total"`
}

type Category struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

type FetchResult struct {
	Message string `json:"message"`
	Saved   int    `json:"saved"`
	Skipped int    `json:"skipped"`
	Total   int    `json:"total"`
}

type Article struct {
	Title       string
	Summary     string
	URL         string
	ImageURL    string
	PublishedAt time.Time
	Source      string
	Category    string
}
