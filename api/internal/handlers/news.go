package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"blognews/internal/services"
)

const maxCategoryLen = 100

type NewsHandler struct {
	svc *services.NewsService
}

func New(svc *services.NewsService) *NewsHandler {
	return &NewsHandler{svc: svc}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func clamp(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func intQuery(r *http.Request, key string, defaultVal int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

func isValidUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		switch i {
		case 8, 13, 18, 23:
			if c != '-' {
				return false
			}
		default:
			if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
				return false
			}
		}
	}
	return true
}

func (h *NewsHandler) ListNews(w http.ResponseWriter, r *http.Request) {
	limit := clamp(intQuery(r, "limit", 20), 1, 100)
	offset := clamp(intQuery(r, "offset", 0), 0, 1<<30)

	category := strings.TrimSpace(r.URL.Query().Get("category"))
	if utf8.RuneCountInString(category) > maxCategoryLen {
		writeError(w, http.StatusBadRequest, "Parâmetro category muito longo")
		return
	}

	result, err := h.svc.List(limit, offset, category)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *NewsHandler) LatestNews(w http.ResponseWriter, r *http.Request) {
	n := clamp(intQuery(r, "n", 6), 1, 20)

	news, err := h.svc.Latest(n)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	writeJSON(w, http.StatusOK, news)
}

func (h *NewsHandler) Categories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.svc.Categories()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	writeJSON(w, http.StatusOK, cats)
}

func (h *NewsHandler) GetNews(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if !isValidUUID(id) {
		writeError(w, http.StatusBadRequest, "ID inválido")
		return
	}

	news, err := h.svc.GetByID(id)
	if err != nil {
		if err == pgx.ErrNoRows {
			writeError(w, http.StatusNotFound, "Notícia não encontrada")
			return
		}
		writeError(w, http.StatusInternalServerError, "Erro interno")
		return
	}
	writeJSON(w, http.StatusOK, news)
}

func (h *NewsHandler) FetchNews(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.FetchAndSave()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Erro ao buscar notícias")
		return
	}
	writeJSON(w, http.StatusOK, result)
}
