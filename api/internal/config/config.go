package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port         string
	DatabaseURL  string
	AnthropicKey string
	APISecretKey string
	CronMorning  string
	CronEvening  string
	TZ           string
	CORSOrigin   string
	ClaudeModel  string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:         getEnv("PORT", "3001"),
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		AnthropicKey: getEnv("ANTHROPIC_API_KEY", ""),
		APISecretKey: getEnv("API_SECRET_KEY", ""),
		CronMorning:  getEnv("CRON_SCHEDULE_MORNING", "0 10 * * *"),
		CronEvening:  getEnv("CRON_SCHEDULE_EVENING", "0 18 * * *"),
		TZ:           getEnv("TZ", "America/Sao_Paulo"),
		CORSOrigin:   getEnv("CORS_ORIGIN", "*"),
		ClaudeModel:  getEnv("CLAUDE_MODEL", "claude-haiku-4-5-20251001"),
	}

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config inválida: %w", err)
	}

	return cfg, nil
}

func (c *Config) validate() error {
	var errs []error
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL é obrigatória"))
	}
	if c.APISecretKey == "" {
		errs = append(errs, errors.New("API_SECRET_KEY é obrigatória"))
	}
	return errors.Join(errs...)
}

func getEnv(key, defaultVal string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return defaultVal
}
