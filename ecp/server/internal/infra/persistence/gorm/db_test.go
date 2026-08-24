package persistence

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/xfzen/ecp/server/config"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestParseDialectRejectsUnknown(t *testing.T) {
	_, err := ParseDialect("sqlite")
	if !errors.Is(err, ErrUnsupportedDialect) {
		t.Fatalf("expected ErrUnsupportedDialect, got %v", err)
	}
}

func TestDatabaseLoggerDoesNotEmitSQLParameters(t *testing.T) {
	config := databaseGORMConfig()
	if config.Logger != logger.Discard {
		t.Fatal("database logger must discard statements and parameters")
	}
}

type testRow struct {
	ID           string `gorm:"primaryKey;size:36"`
	EnterpriseID string `gorm:"size:36;not null"`
	ExternalID   string `gorm:"size:128;not null"`
}

func (testRow) TableName() string { return "ecp_migration_probe" }

func TestWithTxRollsBackOnError(t *testing.T) {
	for _, test := range []struct {
		name   string
		driver string
		env    string
	}{
		{name: "postgres", driver: "postgres", env: "ECP_TEST_POSTGRES_RUNTIME_DSN"},
		{name: "mysql", driver: "mysql", env: "ECP_TEST_MYSQL_RUNTIME_DSN"},
	} {
		t.Run(test.name, func(t *testing.T) {
			dsn := os.Getenv(test.env)
			if dsn == "" {
				t.Skipf("%s is not configured", test.env)
			}
			db, err := Open(config.DatabaseConfig{Driver: test.driver, DSN: dsn})
			if err != nil {
				t.Fatal(err)
			}
			sqlDB, err := db.DB()
			if err != nil {
				t.Fatal(err)
			}
			defer sqlDB.Close()

			injected := errors.New("injected rollback")
			err = WithTx(context.Background(), db, func(tx *gorm.DB) error {
				if err := tx.Create(&testRow{ID: "rollback", EnterpriseID: "transaction-test", ExternalID: "rollback"}).Error; err != nil {
					return err
				}
				return injected
			})
			if !errors.Is(err, injected) {
				t.Fatalf("expected injected rollback, got %v", err)
			}
			var count int64
			if err := db.Model(&testRow{}).Where("id = ?", "rollback").Count(&count).Error; err != nil {
				t.Fatal(err)
			}
			if count != 0 {
				t.Fatalf("rolled-back row persisted: count=%d", count)
			}
		})
	}
}
