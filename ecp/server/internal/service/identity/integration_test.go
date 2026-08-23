package identity_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/domain"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	"github.com/xfzen/ecp/server/internal/service/identity"
	"github.com/xfzen/ecp/server/internal/service/lifecycle"

	"gorm.io/gorm"
)

type fixedClock struct{ value time.Time }

func (c fixedClock) Now() time.Time { return c.value }

func TestIdentityLifecyclePersistsOnBothDialects(t *testing.T) {
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
			rollback := errors.New("rollback identity fixture")
			err = persistence.WithTx(context.Background(), db, func(tx *gorm.DB) error {
				now := time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)
				enterprise := domain.Enterprise{Base: domain.Base{ID: "ent-identity", EnterpriseID: "ent-identity", CreatedAt: now, UpdatedAt: now}, Name: "Identity test", Status: "active"}
				application := domain.Application{Base: domain.Base{ID: "app-identity", EnterpriseID: "ent-identity", CreatedAt: now, UpdatedAt: now}, Key: "identity-test", Name: "Identity test", Status: "active", Version: 1}
				if err := tx.Create(&enterprise).Error; err != nil {
					return err
				}
				if err := tx.Create(&application).Error; err != nil {
					return err
				}
				identityService := identity.New(persistence.NewIdentityStore(tx), []string{"https://idp.example.com"})
				principal, err := identityService.AdmitJIT(context.Background(), identity.JITInput{EnterpriseID: "ent-identity", ApplicationID: "app-identity", Issuer: "https://idp.example.com", Subject: "subject-1", Email: "person@example.com", EmailVerified: true})
				if err != nil {
					return err
				}
				group, err := identityService.CreateManagedGroup(context.Background(), identity.ManagedGroupInput{EnterpriseID: "ent-identity", Name: "Developers"})
				if err != nil {
					return err
				}
				if err := identityService.AddDirectGroupMember(context.Background(), "ent-identity", group.ID, principal.ID); err != nil {
					return err
				}
				members, err := identityService.ListDirectGroupMembers(context.Background(), "ent-identity", group.ID)
				if err != nil || len(members) != 1 || members[0] != principal.ID {
					t.Fatalf("members=%v err=%v", members, err)
				}
				lifecycleService := lifecycle.New(persistence.NewLifecycleStore(tx), fixedClock{value: now}, 5*time.Minute)
				if _, err := lifecycleService.MarkSyncSuccess(context.Background(), "ent-identity", "casdoor", "cursor-1"); err != nil {
					return err
				}
				if err := lifecycleService.AssertFresh(context.Background(), lifecycle.Subject{EnterpriseID: "ent-identity", PrincipalID: principal.ID, Provider: "casdoor", Kind: lifecycle.HumanPrincipal}); err != nil {
					return err
				}
				if _, err := lifecycleService.Block(context.Background(), "ent-identity", principal.ID); err != nil {
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
