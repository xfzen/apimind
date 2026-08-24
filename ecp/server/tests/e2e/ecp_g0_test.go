package e2e

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	operationservice "github.com/xfzen/ecp/server/internal/service/operation"
)

type exportFixture struct{}

func (exportFixture) LoadExportData(context.Context, string, string) (operationservice.ExportData, error) {
	return operationservice.ExportData{
		Enterprise:       operationservice.EnterpriseMetadata{ID: "enterprise-1", Name: "Acme", Status: "active"},
		Application:      operationservice.ApplicationMetadata{ID: "application-1", Key: "apimind", Name: "ApiMind", Status: "active", Version: 2},
		Instance:         operationservice.InstanceMetadata{ID: "instance-1", ApplicationID: "application-1", InstanceKey: "prod", Environment: "production", CanonicalURL: "https://api.example.com", Status: "active", Version: 3},
		IdentityMappings: []operationservice.IdentityMappingMetadata{{ID: "mapping-1", ApplicationID: "application-1", LegacySource: "yapi", LegacySubject: "42", PrincipalID: "principal-1"}},
		Manifests:        []operationservice.ManifestMetadata{{APIVersion: "ecp.xfzen.dev/v1", Hash: "manifest-hash", Version: 4}},
		Policy:           &operationservice.PolicyMetadata{ApplicationInstanceID: "instance-1", PermissionID: "acme/apimind", PolicyIDs: []string{"policy-1"}, CanonicalHash: "policy-hash", ManifestVersion: 4, PolicyVersion: 5, State: "in_sync"},
		Credentials:      []operationservice.CredentialMetadata{{ID: "credential-1", Name: "CI", Status: "active", ScopeCount: 1, ExpiresAt: time.Unix(100, 0).UTC(), Version: 2}},
	}, nil
}
func (exportFixture) LatestBackup(context.Context, string) (domain.BackupOperation, bool, error) {
	return domain.BackupOperation{}, false, nil
}
func (exportFixture) RecordBackup(context.Context, domain.BackupOperation) error { return nil }
func (exportFixture) ExportManifest(context.Context, auditservice.Query) (auditservice.ExportManifest, error) {
	return auditservice.ExportManifest{Version: 1, SequenceStart: 1, SequenceEnd: 3, EventCount: 3, CanonicalHash: "audit-hash"}, nil
}

func TestPortableExportIsVerifiableAndContainsNoSecretMaterial(t *testing.T) {
	fixture := exportFixture{}
	value, err := operationservice.New(fixture, fixture, nil, nil).ExportInstance(context.Background(), "enterprise-1", "instance-1")
	if err != nil {
		t.Fatal(err)
	}
	if !operationservice.VerifyExport(value) {
		t.Fatal("portable export hash did not verify")
	}
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	lower := strings.ToLower(string(raw))
	for _, forbidden := range []string{"secret_digest", "raw_secret", "password", "private_key", "token"} {
		if strings.Contains(lower, forbidden) {
			t.Fatalf("portable export leaked %q: %s", forbidden, raw)
		}
	}
}

func TestPostgresAndMySQLMigrationSetsRemainReversibleAndAligned(t *testing.T) {
	root := repositoryRoot(t)
	postgres := migrationNames(t, filepath.Join(root, "migrations", "postgres"))
	mysql := migrationNames(t, filepath.Join(root, "migrations", "mysql"))
	if !reflect.DeepEqual(postgres, mysql) {
		t.Fatalf("dialect migration sets differ:\npostgres=%v\nmysql=%v", postgres, mysql)
	}
	if len(postgres) != 15 || postgres[len(postgres)-1] != "000015_policy_reconciling_state" {
		t.Fatalf("unexpected migration boundary: %v", postgres)
	}
}

func migrationNames(t *testing.T, directory string) []string {
	t.Helper()
	entries, err := os.ReadDir(directory)
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]map[string]bool{}
	for _, entry := range entries {
		name := entry.Name()
		base, suffix, found := strings.Cut(name, ".")
		if !found || (suffix != "up.sql" && suffix != "down.sql") {
			continue
		}
		if seen[base] == nil {
			seen[base] = map[string]bool{}
		}
		seen[base][suffix] = true
	}
	values := make([]string, 0, len(seen))
	for name, directions := range seen {
		if !directions["up.sql"] || !directions["down.sql"] {
			t.Fatalf("migration %s is not reversible", name)
		}
		values = append(values, name)
	}
	sort.Strings(values)
	return values
}

func repositoryRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	return root
}
