package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/xfzen/ecp/server/internal/contractgen"
)

func main() {
	if len(os.Args) != 3 || os.Args[1] != "openapi" {
		fatalf("usage: contractgen openapi SWAGGER_JSON")
	}
	content, err := contractgen.GenerateOpenAPI(os.Args[2])
	if err != nil {
		fatalf("generate OpenAPI: %v", err)
	}
	if err := writeAtomic("api/openapi/v1/openapi.yaml", content); err != nil {
		fatalf("write OpenAPI: %v", err)
	}
}

func writeAtomic(path string, content []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".contractgen-*")
	if err != nil {
		return err
	}
	temporary := file.Name()
	defer os.Remove(temporary)
	if _, err := file.Write(content); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Chmod(0o644); err != nil {
		_ = file.Close()
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	return os.Rename(temporary, path)
}

func fatalf(format string, values ...any) {
	_, _ = fmt.Fprintf(os.Stderr, format+"\n", values...)
	os.Exit(1)
}
