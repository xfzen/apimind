package session

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/domain"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	idempotencyservice "github.com/xfzen/ecp/server/internal/service/idempotency"

	"gorm.io/gorm"
)

func TestSessionAndIdempotencyPersistOnBothDialects(t *testing.T) {
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
			rollback := errors.New("rollback session fixture")
			err = persistence.WithTx(context.Background(), db, func(tx *gorm.DB) error {
				now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
				enterprise := domain.Enterprise{Base: domain.Base{ID: "ent-session", EnterpriseID: "ent-session", CreatedAt: now, UpdatedAt: now}, Name: "Session test", Status: "active"}
				application := domain.Application{Base: domain.Base{ID: "app-session", EnterpriseID: "ent-session", CreatedAt: now, UpdatedAt: now}, Key: "session-test", Name: "Session test", Status: "active", Version: 1}
				instance := domain.ApplicationInstance{Base: domain.Base{ID: "ins-session", EnterpriseID: "ent-session", CreatedAt: now, UpdatedAt: now}, ApplicationID: "app-session", InstanceKey: "prod", Environment: "production", CanonicalURL: "https://session.example.com", Status: "active", Version: 1}
				client := domain.OIDCClient{Base: domain.Base{ID: "odc-session", EnterpriseID: "ent-session", CreatedAt: now, UpdatedAt: now}, ApplicationID: "app-session", InstanceID: "ins-session", ClientID: "session-client", SecretReference: "secret://session/client", RedirectURIs: []string{"https://session.example.com/callback"}, Status: "active", Version: 1}
				principal := domain.Principal{Base: domain.Base{ID: "pri-session", EnterpriseID: "ent-session", CreatedAt: now, UpdatedAt: now}, OriginApplicationID: "app-session", Issuer: "https://idp.example.com", Subject: "subject-session", NormalizedEmail: "session@example.com", DisplayName: "Session", Status: "active", Version: 1}
				for _, value := range []any{&enterprise, &application, &instance, &client, &principal} {
					if err := tx.Create(value).Error; err != nil {
						return err
					}
				}
				clock := &fakeClock{now: now}
				service := New(persistence.NewSessionStore(tx), clock, time.Hour)
				issued, err := service.IssueProductTransaction(context.Background(), ProductTransactionInput{EnterpriseID: "ent-session", ApplicationInstanceID: "ins-session", PrincipalID: "pri-session"})
				if err != nil {
					return err
				}
				created, err := service.ExchangeProductTransaction(context.Background(), issued.Code)
				if err != nil {
					return err
				}
				resolved, err := service.Resolve(context.Background(), created.Token, ProductSession)
				if err != nil || resolved.ID != created.ID {
					t.Fatalf("resolved=%+v err=%v", resolved, err)
				}
				idem := idempotencyservice.New(persistence.NewIdempotencyStore(tx))
				record, err := idem.Begin(context.Background(), idempotencyservice.BeginInput{EnterpriseID: "ent-session", OperationID: "op-session", Key: "key-session", Method: "POST", CanonicalPath: "/api/v1/test", Payload: []byte(`{"value":1}`)})
				if err != nil {
					return err
				}
				if _, err := idem.Complete(context.Background(), record, 200, []byte(`{"ok":true}`)); err != nil {
					return err
				}
				return rollback
			})
			if !errors.Is(err, rollback) {
				t.Fatal(err)
			}
		})
	}
}
