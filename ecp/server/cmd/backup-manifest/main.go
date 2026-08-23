package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type fileEntry struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
}
type manifest struct {
	Version        uint64            `json:"version"`
	BackupID       string            `json:"backup_id"`
	CreatedAt      time.Time         `json:"created_at"`
	Components     map[string]string `json:"components"`
	DatabaseEngine string            `json:"database_engine"`
	Encryption     string            `json:"encryption"`
	RestoreOrder   []string          `json:"restore_order"`
	Files          []fileEntry       `json:"files"`
}

func main() {
	directory := flag.String("dir", "", "backup directory")
	output := flag.String("output", "", "manifest output")
	input := flag.String("manifest", "", "manifest to verify")
	backupID := flag.String("backup-id", "", "backup ID")
	ecpVersion := flag.String("ecp-version", "dev", "ECP version")
	casdoorVersion := flag.String("casdoor-version", "3.154.4", "Casdoor version")
	apiMindVersion := flag.String("apimind-version", "dev", "ApiMind version")
	engine := flag.String("database-engine", "postgres-17.6", "database engine and version")
	encryption := flag.String("encryption", "external", "encryption metadata")
	flag.Parse()
	if *input != "" {
		if err := verify(*input); err != nil {
			fatalf("%v", err)
		}
		fmt.Println("verified")
		return
	}
	if *directory == "" || *output == "" || *backupID == "" {
		fatalf("create requires --dir, --output, and --backup-id")
	}
	value := manifest{Version: 1, BackupID: *backupID, CreatedAt: time.Now().UTC(), Components: map[string]string{"ecp": *ecpVersion, "casdoor": *casdoorVersion, "apimind": *apiMindVersion}, DatabaseEngine: *engine, Encryption: *encryption, RestoreOrder: []string{"casdoor", "ecp", "apimind"}}
	for _, name := range []string{"casdoor.dump", "ecp.dump", "apimind.archive"} {
		entry, err := hashFile(filepath.Join(*directory, name), name)
		if err != nil {
			fatalf("%v", err)
		}
		value.Files = append(value.Files, entry)
	}
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		fatalf("%v", err)
	}
	if err := os.WriteFile(*output, append(encoded, '\n'), 0o600); err != nil {
		fatalf("%v", err)
	}
}

func verify(path string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var value manifest
	if err := json.Unmarshal(raw, &value); err != nil {
		return err
	}
	if value.Version != 1 || value.BackupID == "" || len(value.Files) != 3 || len(value.RestoreOrder) != 3 {
		return fmt.Errorf("invalid backup manifest")
	}
	base := filepath.Dir(path)
	for _, expected := range value.Files {
		if filepath.Base(expected.Path) != expected.Path || strings.Contains(expected.Path, "..") {
			return fmt.Errorf("unsafe backup path")
		}
		actual, err := hashFile(filepath.Join(base, expected.Path), expected.Path)
		if err != nil {
			return err
		}
		if actual.SHA256 != expected.SHA256 || actual.Size != expected.Size {
			return fmt.Errorf("backup hash mismatch: %s", expected.Path)
		}
	}
	return nil
}

func hashFile(path, name string) (fileEntry, error) {
	file, err := os.Open(path)
	if err != nil {
		return fileEntry{}, err
	}
	defer file.Close()
	hash := sha256.New()
	size, err := io.Copy(hash, file)
	if err != nil {
		return fileEntry{}, err
	}
	return fileEntry{Path: name, SHA256: hex.EncodeToString(hash.Sum(nil)), Size: size}, nil
}
func fatalf(format string, values ...any) {
	_, _ = fmt.Fprintf(os.Stderr, format+"\n", values...)
	os.Exit(1)
}
