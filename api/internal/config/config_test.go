package config_test

import (
	"testing"

	"blognews/internal/config"
)

func setEnv(t *testing.T, env map[string]string) {
	t.Helper()
	for k, v := range env {
		t.Setenv(k, v)
	}
}

func baseEnv() map[string]string {
	return map[string]string{
		"DATABASE_URL":   "postgres://user:pass@localhost/testdb",
		"API_SECRET_KEY": "test-secret",
	}
}

func TestLoad_Valid(t *testing.T) {
	setEnv(t, baseEnv())

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load() erro inesperado: %v", err)
	}
	if cfg.Port != "3001" {
		t.Errorf("Port = %q; quer %q", cfg.Port, "3001")
	}
	if cfg.TZ != "America/Sao_Paulo" {
		t.Errorf("TZ = %q; quer %q", cfg.TZ, "America/Sao_Paulo")
	}
	if cfg.CORSOrigin != "*" {
		t.Errorf("CORSOrigin = %q; quer %q", cfg.CORSOrigin, "*")
	}
}

func TestLoad_MissingDatabaseURL(t *testing.T) {
	env := baseEnv()
	delete(env, "DATABASE_URL")
	t.Setenv("DATABASE_URL", "")
	setEnv(t, env)

	_, err := config.Load()
	if err == nil {
		t.Fatal("Load() deveria falhar com DATABASE_URL ausente")
	}
}

func TestLoad_MissingAPISecretKey(t *testing.T) {
	env := baseEnv()
	delete(env, "API_SECRET_KEY")
	t.Setenv("API_SECRET_KEY", "")
	setEnv(t, env)

	_, err := config.Load()
	if err == nil {
		t.Fatal("Load() deveria falhar com API_SECRET_KEY ausente")
	}
}

func TestLoad_CustomPort(t *testing.T) {
	setEnv(t, baseEnv())
	t.Setenv("PORT", "8080")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load() erro inesperado: %v", err)
	}
	if cfg.Port != "8080" {
		t.Errorf("Port = %q; quer %q", cfg.Port, "8080")
	}
}

func TestLoad_CustomClaudeModel(t *testing.T) {
	setEnv(t, baseEnv())
	t.Setenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")

	cfg, err := config.Load()
	if err != nil {
		t.Fatalf("Load() erro inesperado: %v", err)
	}
	if cfg.ClaudeModel != "claude-3-5-sonnet-20241022" {
		t.Errorf("ClaudeModel = %q; quer %q", cfg.ClaudeModel, "claude-3-5-sonnet-20241022")
	}
}
