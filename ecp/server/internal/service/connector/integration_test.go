package connector

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/domain"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	"gorm.io/gorm"
)

func TestConnectorReplayStatePersistsOnBothDialects(t *testing.T) {
	for _, test := range []struct{ name, driver, env string }{{"postgres", "postgres", "ECP_TEST_POSTGRES_RUNTIME_DSN"}, {"mysql", "mysql", "ECP_TEST_MYSQL_RUNTIME_DSN"}} {
		t.Run(test.name, func(t *testing.T) {
			dsn := os.Getenv(test.env); if dsn == "" { t.Skipf("%s is not configured", test.env) }
			db, err := persistence.Open(config.DatabaseConfig{Driver: test.driver, DSN: dsn}); if err != nil { t.Fatal(err) }; sqlDB, _ := db.DB(); defer sqlDB.Close()
			rollback := errors.New("rollback connector fixture")
			err = persistence.WithTx(context.Background(), db, func(tx *gorm.DB) error {
				now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC); store := persistence.NewConnectorStore(tx)
				nonce := domain.DelegationNonce{ID: "connector-replay-nonce", Issuer: "ecp", Audience: "instance-a", Purpose: domain.DelegationPurposeProduct, Nonce: "nonce-a", ExpiresAt: now.Add(time.Minute), CreatedAt: now}
				first, err := store.ConsumeNonce(context.Background(), nonce); if err != nil || !first { t.Fatalf("first consume=%v err=%v", first, err) }
				second, err := store.ConsumeNonce(context.Background(), nonce); if err != nil || second { t.Fatalf("second consume=%v err=%v", second, err) }
				return rollback
			}); if !errors.Is(err, rollback) { t.Fatal(err) }
		})
	}
}
