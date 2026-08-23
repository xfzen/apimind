package contracts

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func repositoryRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs(filepath.Join("..", ".."))
	if err != nil {
		t.Fatal(err)
	}
	return root
}

func TestGenerationIsIdempotent(t *testing.T) {
	root := repositoryRoot(t)
	runGeneration(t, root)
	first := generatedSnapshot(t, root)
	runGeneration(t, root)
	second := generatedSnapshot(t, root)
	if !bytes.Equal(first, second) {
		t.Fatal("contract generation changed bytes on the second run")
	}
}

func runGeneration(t *testing.T, root string) {
	t.Helper()
	command := exec.Command(filepath.Join(root, "scripts", "gencontracts.sh"))
	command.Dir = root
	command.Env = append(os.Environ(), "GOWORK="+filepath.Join(root, "..", "go.work"), "GOTOOLCHAIN=go1.25.12")
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("generate contracts: %v\n%s", err, output)
	}
}

func generatedSnapshot(t *testing.T, root string) []byte {
	t.Helper()
	var snapshot []byte
	for _, name := range []string{
		"docs/ecp.api",
		"api/internal/handler/routes.go",
		"api/internal/types/types.go",
		"api/openapi/v1/openapi.yaml",
	} {
		content, err := os.ReadFile(filepath.Join(root, name))
		if err != nil {
			t.Fatal(err)
		}
		snapshot = append(snapshot, []byte(name)...)
		snapshot = append(snapshot, 0)
		snapshot = append(snapshot, content...)
		snapshot = append(snapshot, 0)
	}
	return snapshot
}

func TestGenerationUsesCanonicalContract(t *testing.T) {
	script, err := os.ReadFile(filepath.Join(repositoryRoot(t), "scripts", "genapi.sh"))
	if err != nil {
		t.Fatal(err)
	}
	body := string(script)
	for _, required := range []string{
		`"$tool_bin/goctl" api go -api docs/ecp.api -dir api`,
		"perl -0pi -e 's/\\n+\\z/\\n/' docs/ecp.api",
		"rm -rf api/etc",
		"rm -rf api/internal/config",
	} {
		if !strings.Contains(body, required) {
			t.Fatalf("genapi.sh missing %q", required)
		}
	}
}
