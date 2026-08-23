package registry_test

import (
	"context"
	"os"
	"testing"

	"github.com/xfzen/ecp/server/config"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	"github.com/xfzen/ecp/server/internal/service/registry"
)

func TestRegistryPersistsOnBothDialects(t *testing.T) {
	for _, test := range []struct {
		name, driver, env string
	}{
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
			svc := registry.New(persistence.NewRegistryStore(db))
			ctx := context.Background()
			if _, err := svc.RegisterEnterprise(ctx, registry.RegisterEnterpriseInput{ID: "ent-1", Name: "Acme"}); err != nil {
				t.Fatal(err)
			}
			if _, err := svc.RegisterApplication(ctx, registry.RegisterApplicationInput{ID: "app-1", EnterpriseID: "ent-1", Key: "apimind", Name: "ApiMind"}); err != nil {
				t.Fatal(err)
			}
			instance, err := svc.RegisterInstance(ctx, registry.RegisterInstanceInput{EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceKey: "prod", CanonicalURL: "https://api.example.com"})
			if err != nil {
				t.Fatal(err)
			}
			manifest := []byte(`{"schema_version":"connector.manifest/v1","product":"apimind","roles":[{"id":"project.viewer","resource_type":"project","actions":["project.read"]}]}`)
			if _, err := svc.PutManifest(ctx, registry.PutManifestInput{EnterpriseID: "ent-1", ApplicationID: "app-1", APIVersion: "connector.manifest/v1", Body: manifest}); err != nil {
				t.Fatal(err)
			}
			updated, err := svc.PutManifest(ctx, registry.PutManifestInput{EnterpriseID: "ent-1", ApplicationID: "app-1", APIVersion: "connector.manifest/v1", Body: manifest})
			if err != nil {
				t.Fatal(err)
			}
			if updated.Version != 2 {
				t.Fatalf("manifest version=%d", updated.Version)
			}
			if _, err := svc.RegisterConnector(ctx, registry.RegisterConnectorInput{EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceID: instance.ID, ConnectorKey: "primary"}); err != nil {
				t.Fatal(err)
			}
		})
	}
}
