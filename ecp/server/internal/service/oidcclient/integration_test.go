package oidcclient_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/domain"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	"github.com/xfzen/ecp/server/internal/service/oidcclient"

	"gorm.io/gorm"
)

func TestOIDCClientPersistsOnBothDialects(t *testing.T) {
	for _, test := range []struct{ name, driver, env string }{
		{name: "postgres", driver: "postgres", env: "ECP_TEST_POSTGRES_RUNTIME_DSN"},
		{name: "mysql", driver: "mysql", env: "ECP_TEST_MYSQL_RUNTIME_DSN"},
	} {
		t.Run(test.name, func(t *testing.T) {
			dsn := os.Getenv(test.env)
			if dsn == "" {
				t.Skipf("%s is not configured", test.env)
			}
			db, err := persistence.Open(config.DatabaseConfig{Driver: test.driver, DSN: dsn})
			if err != nil {
				t.Fatal(err)
			}
			sqlDB, _ := db.DB()
			defer sqlDB.Close()
			rollback := errors.New("rollback fixture")
			err = persistence.WithTx(context.Background(), db, func(tx *gorm.DB) error {
				now := time.Now().UTC()
				enterprise := domain.Enterprise{Base: domain.Base{ID: "ent-oidc", EnterpriseID: "ent-oidc", CreatedAt: now, UpdatedAt: now}, Name: "OIDC test", Status: "active"}
				application := domain.Application{Base: domain.Base{ID: "app-oidc", EnterpriseID: "ent-oidc", CreatedAt: now, UpdatedAt: now}, Key: "oidc-test", Name: "OIDC test", Status: "active", Version: 1}
				instance := domain.ApplicationInstance{Base: domain.Base{ID: "ins-oidc", EnterpriseID: "ent-oidc", CreatedAt: now, UpdatedAt: now}, ApplicationID: "app-oidc", InstanceKey: "prod", Environment: "production", CanonicalURL: "https://oidc.example.com", Status: "active", Version: 1}
				if err := tx.Create(&enterprise).Error; err != nil {
					return err
				}
				if err := tx.Create(&application).Error; err != nil {
					return err
				}
				if err := tx.Create(&instance).Error; err != nil {
					return err
				}
				service := oidcclient.New(persistence.NewOIDCClientStore(tx), false)
				created, err := service.Register(context.Background(), oidcclient.RegisterInput{
					EnterpriseID: "ent-oidc", ApplicationID: "app-oidc", InstanceID: "ins-oidc", ClientID: "client-oidc",
					SecretReference: "secret://oidc/client-oidc", RedirectURIs: []string{"https://oidc.example.com/callback"},
				})
				if err != nil {
					return err
				}
				rotated, err := service.RotateSecret(context.Background(), "ent-oidc", created.ID, "secret://oidc/client-oidc-v2")
				if err != nil {
					return err
				}
				if rotated.Version != 2 || rotated.RedirectURIs[0] != "https://oidc.example.com/callback" {
					t.Fatalf("unexpected persisted client: %+v", rotated)
				}
				return rollback
			})
			if !errors.Is(err, rollback) {
				t.Fatal(err)
			}
		})
	}
}
