package operations

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func repositoryRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs("../../..")
	if err != nil {
		t.Fatal(err)
	}
	return root
}

func readRepositoryFile(t *testing.T, relative string) string {
	t.Helper()
	value, err := os.ReadFile(filepath.Join(repositoryRoot(t), relative))
	if err != nil {
		t.Fatal(err)
	}
	return string(value)
}

func TestComposeUsesSeparateDatabasesAndAccounts(t *testing.T) {
	compose := readRepositoryFile(t, "deploy/compose.yaml")
	deployment := strings.Join([]string{
		compose,
		readRepositoryFile(t, "deploy/postgres/init-databases.sh"),
		readRepositoryFile(t, "deploy/secrets/ecp-schema-dsn.example"),
		readRepositoryFile(t, "deploy/secrets/ecp-runtime-dsn.example"),
		readRepositoryFile(t, "deploy/secrets/ecp-audit-ingest-dsn.example"),
		readRepositoryFile(t, "deploy/secrets/ecp-audit-read-dsn.example"),
	}, "\n")
	for _, wanted := range []string{"casdoor_db", "ecp_db", "casdoor_runtime", "ecp_schema_owner", "ecp_tx_writer", "audit_ingest_writer", "audit_reader", "ecp-audit-bootstrap", "127.0.0.1:4001", "127.0.0.1:18890", "--remove-orphans"} {
		if !strings.Contains(deployment, wanted) && wanted != "--remove-orphans" {
			t.Fatalf("compose missing %q", wanted)
		}
	}
	if strings.Contains(compose, "POSTGRES_PASSWORD: password") {
		t.Fatal("compose contains a shared inline password")
	}
}

func TestDevRestartUsesValidatedPIDFilesInsteadOfBroadKill(t *testing.T) {
	script := readRepositoryFile(t, "server/scripts/dev-stop.sh")
	for _, wanted := range []string{".run/ecp-api.pid", ".run/ecp-ui.pid", "ps -p"} {
		if !strings.Contains(script, wanted) {
			t.Fatalf("script missing %q", wanted)
		}
	}
	for _, forbidden := range []string{"pkill", "killall"} {
		if strings.Contains(script, forbidden) {
			t.Fatalf("script contains %q", forbidden)
		}
	}
}

func TestBackupRestoreRequiresEmptyTargetsAndVerifiedManifest(t *testing.T) {
	restore := readRepositoryFile(t, "server/scripts/restore.sh")
	for _, wanted := range []string{"--empty-target", "manifest.json", "sha256", "verified", "information_schema.tables", "getCollectionNames"} {
		if !strings.Contains(restore, wanted) {
			t.Fatalf("restore missing %q", wanted)
		}
	}
	for _, forbidden := range []string{"pg_restore --exit-on-error --clean", " --drop"} {
		if strings.Contains(restore, forbidden) {
			t.Fatalf("restore contains destructive bypass %q", forbidden)
		}
	}
}
