package access

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/domain"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	securityconfigservice "github.com/xfzen/ecp/server/internal/service/securityconfig"
	"gorm.io/gorm"
)

func TestAuthorizationStatePersistsOnBothDialects(t *testing.T) {
	for _, test := range []struct{ name, driver, env string }{{"postgres", "postgres", "ECP_TEST_POSTGRES_RUNTIME_DSN"}, {"mysql", "mysql", "ECP_TEST_MYSQL_RUNTIME_DSN"}} {
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
			rollback := errors.New("rollback access fixture")
			err = persistence.WithTx(context.Background(), db, func(tx *gorm.DB) error {
				now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
				deadline := now.Add(5 * time.Minute)
				enterprise := domain.Enterprise{Base: domain.Base{ID: "ent-access", EnterpriseID: "ent-access", CreatedAt: now, UpdatedAt: now}, Name: "Access", Status: "active"}
				application := domain.Application{Base: domain.Base{ID: "app-access", EnterpriseID: "ent-access", CreatedAt: now, UpdatedAt: now}, Key: "access", Name: "Access", Status: "active", Version: 1}
				instance := domain.ApplicationInstance{Base: domain.Base{ID: "ins-access", EnterpriseID: "ent-access", CreatedAt: now, UpdatedAt: now}, ApplicationID: "app-access", InstanceKey: "prod", Environment: "production", CanonicalURL: "https://access.example.com", Status: "active", Version: 1}
				principal := domain.Principal{Base: domain.Base{ID: "pri-access", EnterpriseID: "ent-access", CreatedAt: now, UpdatedAt: now}, OriginApplicationID: "app-access", Issuer: "https://idp.example.com", Subject: "subject", NormalizedEmail: "access@example.com", DisplayName: "Access", Status: "active", Version: 1}
				lifecycle := domain.PrincipalLifecycle{Base: domain.Base{ID: "lif-access", EnterpriseID: "ent-access", CreatedAt: now, UpdatedAt: now}, PrincipalID: "pri-access", State: "active", Version: 1}
				syncState := domain.IdentitySyncState{Base: domain.Base{ID: "syn-access", EnterpriseID: "ent-access", CreatedAt: now, UpdatedAt: now}, Provider: "casdoor", Version: 1, LastSuccessfulSync: &now, FreshnessDeadline: &deadline, SourceCursor: "cursor", State: "fresh", LastError: ""}
				for _, value := range []any{&enterprise, &application, &instance, &principal, &lifecycle, &syncState} {
					if err := tx.Create(value).Error; err != nil {
						return err
					}
				}
				projectionStore := persistence.NewPolicyStore(tx)
				if _, err := projectionStore.Put(context.Background(), domain.PolicyProjection{Base: domain.Base{ID: "pol-access", EnterpriseID: "ent-access", CreatedAt: now, UpdatedAt: now}, ApplicationInstanceID: "ins-access", CasdoorPermissionID: "ent-access/apimind-ins-access", CasdoorPolicyIDs: []string{"ent-access/read"}, NormalizedHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", ManifestVersion: 1, PolicyVersion: 1, ReconciliationState: "in_sync", LastError: ""}); err != nil {
					return err
				}
				security := securityconfigservice.New(persistence.NewSecurityConfigStore(tx))
				if _, err := security.Put(context.Background(), securityconfigservice.PutInput{EnterpriseID: "ent-access", ApplicationInstanceID: "ins-access", ExportEnabled: true}); err != nil {
					return err
				}
				clock := &fakeClock{now: now}
				service := New(persistence.NewAccessStore(tx), &fakeEngine{allow: true}, nil, clock)
				decision, err := service.Authorize(context.Background(), domain.AuthorizationRequest{EnterpriseID: "ent-access", ApplicationInstanceID: "ins-access", PrincipalID: "pri-access", PrincipalKind: "human", IdentityProvider: "casdoor", Action: "project.read", ResourceID: "project-1", ResourceVersion: 1})
				if err != nil || !decision.Allow {
					t.Fatalf("decision=%+v err=%v", decision, err)
				}
				return rollback
			})
			if !errors.Is(err, rollback) {
				t.Fatal(err)
			}
		})
	}
}
