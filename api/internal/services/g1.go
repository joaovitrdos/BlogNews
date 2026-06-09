package services

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"blognews/internal/models"
)

const (
	maxRSSBodyBytes = 2 << 20
	itemsPerFeed    = 10
	g1UserAgent     = "BlogNews/2.0 (Go)"
	rssTimeout      = 12 * time.Second
)

var g1Feeds = []struct {
	URL      string
	Category string
}{
	{"https://g1.globo.com/rss/g1/", "Geral"},
	{"https://g1.globo.com/rss/g1/politica/", "Política"},
	{"https://g1.globo.com/rss/g1/economia/", "Economia"},
	{"https://g1.globo.com/rss/g1/tecnologia/", "Tecnologia"},
	{"https://g1.globo.com/rss/g1/saude/", "Saúde"},
	{"https://g1.globo.com/rss/g1/educacao/", "Educação"},
	{"https://g1.globo.com/rss/g1/esporte/", "Esporte"},
	{"https://g1.globo.com/rss/g1/mundo/", "Mundo"},
}

type rssRoot struct {
	Channel rssChannel `xml:"channel"`
}

type rssChannel struct {
	Items []rssItem `xml:"item"`
}

type rssItem struct {
	Title          string       `xml:"title"`
	Link           string       `xml:"link"`
	Description    string       `xml:"description"`
	PubDate        string       `xml:"pubDate"`
	Enclosure      rssEnclosure `xml:"enclosure"`
	MediaContent   rssMedia     `xml:"http://search.yahoo.com/mrss/ content"`
	ContentEncoded string       `xml:"http://purl.org/rss/1.0/modules/content/ encoded"`
}

type rssEnclosure struct {
	URL string `xml:"url,attr"`
}

type rssMedia struct {
	URL string `xml:"url,attr"`
}

var (
	htmlTagRe = regexp.MustCompile(`<[^>]+>`)
	imgSrcRe  = regexp.MustCompile(`<img[^>]+src="([^"]+)"`)

	pubDateLayouts = []string{
		time.RFC1123Z,
		time.RFC1123,
		"02 Jan 2006 15:04:05 -0700",
		"Mon, 2 Jan 2006 15:04:05 -0700",
	}
)

func fetchG1Articles(client *http.Client) []models.Article {
	type result struct {
		articles []models.Article
	}

	ch := make(chan result, len(g1Feeds))
	var wg sync.WaitGroup

	for _, feed := range g1Feeds {
		wg.Add(1)
		go func(url, category string) {
			defer wg.Done()
			articles, err := parseFeed(client, url, category)
			if err != nil {
				ch <- result{}
				return
			}
			ch <- result{articles: articles}
		}(feed.URL, feed.Category)
	}

	go func() {
		wg.Wait()
		close(ch)
	}()

	seen := make(map[string]struct{})
	var all []models.Article

	for r := range ch {
		for _, a := range r.articles {
			if _, ok := seen[a.URL]; !ok {
				seen[a.URL] = struct{}{}
				all = append(all, a)
			}
		}
	}

	return all
}

func parseFeed(client *http.Client, url, category string) ([]models.Article, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("criar request: %w", err)
	}
	req.Header.Set("User-Agent", g1UserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch feed: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxRSSBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("ler corpo: %w", err)
	}

	var feed rssRoot
	if err := xml.Unmarshal(raw, &feed); err != nil {
		return nil, fmt.Errorf("parsear xml: %w", err)
	}

	items := feed.Channel.Items
	if len(items) > itemsPerFeed {
		items = items[:itemsPerFeed]
	}

	articles := make([]models.Article, 0, len(items))
	for _, item := range items {
		if item.Link == "" || item.Title == "" {
			continue
		}

		summary := stripHTML(item.Description)
		if summary == "" {
			summary = stripHTML(item.ContentEncoded)
		}

		articles = append(articles, models.Article{
			Title:   strings.TrimSpace(item.Title),
			Summary: summary,
			URL:     strings.TrimSpace(item.Link),
			ImageURL: firstNonEmpty(
				item.Enclosure.URL,
				item.MediaContent.URL,
				extractImageURL(item.ContentEncoded),
				extractImageURL(item.Description),
			),
			PublishedAt: parsePubDate(item.PubDate),
			Source:      "G1",
			Category:    category,
		})
	}

	return articles, nil
}

func parsePubDate(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	for _, layout := range pubDateLayouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t
		}
	}
	return time.Now()
}

func stripHTML(s string) string {
	s = htmlTagRe.ReplaceAllString(s, "")
	return strings.TrimSpace(strings.Join(strings.Fields(s), " "))
}

func extractImageURL(content string) string {
	m := imgSrcRe.FindStringSubmatch(content)
	if len(m) > 1 {
		return m[1]
	}
	return ""
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
