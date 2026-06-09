package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(connStr string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("parse db config: %w", err)
	}

	cfg.MaxConns = 10
	cfg.MinConns = 2
	cfg.MaxConnIdleTime = 30 * time.Minute
	cfg.ConnConfig.ConnectTimeout = 10 * time.Second

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}

	return pool, nil
}

func RunMigrations(pool *pgxpool.Pool) error {
	_, err := pool.Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS news (
			id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
			title        VARCHAR(500) NOT NULL,
			summary      TEXT,
			url          TEXT         UNIQUE NOT NULL,
			source       VARCHAR(100) DEFAULT 'G1',
			category     VARCHAR(100) DEFAULT 'Geral',
			image_url    TEXT,
			published_at TIMESTAMPTZ,
			ai_summary   TEXT,
			ai_keywords  TEXT[]       DEFAULT '{}',
			created_at   TIMESTAMPTZ  DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_news_created_at   ON news (created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_news_category     ON news (category);
		CREATE INDEX IF NOT EXISTS idx_news_published_at ON news (published_at DESC);
	`)
	if err != nil {
		return fmt.Errorf("migrations: %w", err)
	}
	return nil
}
