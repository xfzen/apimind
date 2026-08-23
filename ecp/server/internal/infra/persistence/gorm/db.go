package persistence

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/config"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func Open(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dialect, err := ParseDialect(cfg.Driver)
	if err != nil {
		return nil, err
	}
	if cfg.DSN == "" {
		return nil, fmt.Errorf("database DSN is required")
	}
	var dialector gorm.Dialector
	switch dialect {
	case DialectPostgres:
		dialector = postgres.Open(cfg.DSN)
	case DialectMySQL:
		dialector = mysql.Open(cfg.DSN)
	}
	db, err := gorm.Open(dialector, &gorm.Config{DisableAutomaticPing: true})
	if err != nil {
		return nil, fmt.Errorf("open %s database: %w", dialect, err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("access database pool: %w", err)
	}
	if cfg.MaxOpenConns > 0 {
		sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns > 0 {
		sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	}
	if cfg.ConnMaxLifetime > 0 {
		sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	}
	if err := sqlDB.PingContext(context.Background()); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("ping %s database: %w", dialect, err)
	}
	return db, nil
}
