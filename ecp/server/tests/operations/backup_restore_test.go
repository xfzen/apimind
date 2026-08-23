package operations

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestBackupManifestVerifiesAndRejectsTampering(t *testing.T) {
	backupDir := t.TempDir()
	for _, name := range []string{"casdoor.dump", "ecp.dump", "apimind.archive"} {
		if err := os.WriteFile(filepath.Join(backupDir, name), []byte("fixture:"+name), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	manifestPath := filepath.Join(backupDir, "manifest.json")
	runBackupManifest(t, "--dir", backupDir, "--output", manifestPath, "--backup-id", "backup-1")
	if output := runBackupManifest(t, "--manifest", manifestPath); strings.TrimSpace(output) != "verified" {
		t.Fatalf("unexpected verification output %q", output)
	}
	if err := os.WriteFile(filepath.Join(backupDir, "ecp.dump"), []byte("tampered"), 0o600); err != nil {
		t.Fatal(err)
	}
	cmd := backupManifestCommand(t, "--manifest", manifestPath)
	if output, err := cmd.CombinedOutput(); err == nil || !strings.Contains(string(output), "backup hash mismatch") {
		t.Fatalf("tampered backup accepted: err=%v output=%s", err, output)
	}
}

func runBackupManifest(t *testing.T, args ...string) string {
	t.Helper()
	cmd := backupManifestCommand(t, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("backup manifest failed: %v\n%s", err, output)
	}
	return string(output)
}

func backupManifestCommand(t *testing.T, args ...string) *exec.Cmd {
	t.Helper()
	serverRoot := filepath.Join(repositoryRoot(t), "server")
	cmdArgs := append([]string{"run", "./cmd/backup-manifest"}, args...)
	cmd := exec.Command("go", cmdArgs...)
	cmd.Dir = serverRoot
	cmd.Env = append(os.Environ(), "GOWORK=off")
	return cmd
}
