package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"blognews/internal/middleware"
)

func TestAPIKey(t *testing.T) {
	const secret = "s3cr3t-t3st-k3y"

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := middleware.APIKey(secret)(next)

	tests := []struct {
		name       string
		key        string
		wantStatus int
	}{
		{"chave válida", secret, http.StatusOK},
		{"chave errada", "wrong-key", http.StatusUnauthorized},
		{"chave vazia", "", http.StatusUnauthorized},
		{"chave parcial", secret[:4], http.StatusUnauthorized},
		{"chave com espaço extra", secret + " ", http.StatusUnauthorized},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tt.key != "" {
				req.Header.Set("x-api-key", tt.key)
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d; quer %d", rec.Code, tt.wantStatus)
			}
		})
	}
}
