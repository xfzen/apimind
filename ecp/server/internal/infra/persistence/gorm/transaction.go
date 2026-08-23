package persistence

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

func WithTx(ctx context.Context, db *gorm.DB, fn func(*gorm.DB) error) error {
	if db == nil {
		return fmt.Errorf("database is required")
	}
	if fn == nil {
		return fmt.Errorf("transaction function is required")
	}
	return db.WithContext(ctx).Transaction(fn)
}
