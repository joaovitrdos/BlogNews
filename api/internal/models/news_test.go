package models_test

import (
	"testing"

	"blognews/internal/models"
)

func TestNormalizeKeywords(t *testing.T) {
	t.Run("nil vira slice vazio", func(t *testing.T) {
		n := &models.News{Keywords: nil}
		n.NormalizeKeywords()
		if n.Keywords == nil {
			t.Fatal("Keywords não deve ser nil após NormalizeKeywords()")
		}
		if len(n.Keywords) != 0 {
			t.Errorf("esperava slice vazio, got %v", n.Keywords)
		}
	})

	t.Run("keywords existentes são preservadas", func(t *testing.T) {
		kw := []string{"go", "backend", "api"}
		n := &models.News{Keywords: kw}
		n.NormalizeKeywords()
		if len(n.Keywords) != len(kw) {
			t.Errorf("esperava %d keywords, got %d", len(kw), len(n.Keywords))
		}
		for i, k := range kw {
			if n.Keywords[i] != k {
				t.Errorf("keyword[%d] = %q; quer %q", i, n.Keywords[i], k)
			}
		}
	})
}
