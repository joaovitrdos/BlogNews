package middleware

import (
	"crypto/subtle"
	"net/http"
)

func APIKey(secret string) func(http.Handler) http.Handler {
	secretBytes := []byte(secret)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("x-api-key")

			valid := len(key) > 0 &&
				subtle.ConstantTimeCompare([]byte(key), secretBytes) == 1

			if !valid {
				w.Header().Set("Content-Type", "application/json")
				http.Error(w, `{"error":"Chave de API inválida"}`, http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
