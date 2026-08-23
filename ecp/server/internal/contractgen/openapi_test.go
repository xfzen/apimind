package contractgen

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestOpenAPIGenerationIsDeterministic(t *testing.T) {
	fixture := []byte(`{"swagger":"2.0","info":{"title":"fixture"},"paths":{"/api/v1/meta/health":{"get":{"operationId":"Health","responses":{"200":{"description":"ok","schema":{"$ref":"#/definitions/HealthResp"}}}}}},"definitions":{"HealthResp":{"type":"object","properties":{"status":{"type":"string"}}}}}`)
	path := filepath.Join(t.TempDir(), "swagger.json")
	if err := os.WriteFile(path, fixture, 0o600); err != nil {
		t.Fatal(err)
	}
	first, err := GenerateOpenAPI(path)
	if err != nil {
		t.Fatal(err)
	}
	second, err := GenerateOpenAPI(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(first, second) {
		t.Fatal("OpenAPI generation is not deterministic")
	}
	for _, required := range [][]byte{[]byte("openapi: 3.0.3"), []byte("#/components/schemas/HealthResp"), []byte("x-ecp-access: public"), []byte("content:"), []byte("application/json:")} {
		if !bytes.Contains(first, required) {
			t.Fatalf("OpenAPI missing %q", required)
		}
	}
}
