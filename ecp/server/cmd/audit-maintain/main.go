package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/config"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
)

func main() {
	if len(os.Args) < 2 {
		fail("usage: audit-maintain archive|export-verifier-bundle")
	}
	switch os.Args[1] {
	case "archive":
		archive(os.Args[2:])
	case "export-verifier-bundle":
		exportBundle(os.Args[2:])
	default:
		fail("unknown command")
	}
}
func archive(args []string) {
	flags := flag.NewFlagSet("archive", flag.ExitOnError)
	driver := flags.String("driver", "", "database driver")
	dsnRef := flags.String("maintainer-dsn-ref", "", "maintainer DSN secret reference")
	privateRef := flags.String("private-key-ref", "", "archive private key secret reference")
	publicRef := flags.String("public-key-ref", "", "archive public key secret reference")
	keyID := flags.String("key-id", "", "archive signing key ID")
	sequenceEnd := flags.Uint64("sequence-end", 0, "last sequence to archive")
	limit := flags.Int("limit", 1000, "maximum event count")
	_ = flags.Parse(args)
	provider := envProvider{}
	rawDSN, err := provider.Get(context.Background(), *dsnRef)
	if err != nil {
		fail(err.Error())
	}
	db, err := persistence.Open(config.DatabaseConfig{Driver: *driver, DSN: string(rawDSN), MaxOpenConns: 1, MaxIdleConns: 0, ConnMaxLifetime: time.Minute})
	if err != nil {
		fail(err.Error())
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	service := auditservice.NewArchiveService(persistence.NewAuditArchiveStore(db), provider, auditservice.ArchiveConfig{PrivateKeyReference: *privateRef, PublicKeyReference: *publicRef, SigningKeyID: *keyID})
	signed, err := service.ArchiveExpired(context.Background(), *sequenceEnd, *limit)
	if err != nil {
		fail(err.Error())
	}
	encoded, _ := json.Marshal(signed)
	_, _ = os.Stdout.Write(append(encoded, '\n'))
}
func exportBundle(args []string) {
	flags := flag.NewFlagSet("export-verifier-bundle", flag.ExitOnError)
	input := flags.String("keys", "", "versioned verifier key JSON")
	_ = flags.Parse(args)
	data, err := os.ReadFile(*input)
	if err != nil {
		fail(err.Error())
	}
	var keys []auditservice.VerifierKey
	if err := json.Unmarshal(data, &keys); err != nil {
		fail(err.Error())
	}
	encoded, err := auditservice.ExportVerifierBundle(keys)
	if err != nil {
		fail(err.Error())
	}
	_, _ = os.Stdout.Write(append(encoded, '\n'))
}

type envProvider struct{}

func (envProvider) Get(_ context.Context, reference string) ([]byte, error) {
	if !strings.HasPrefix(reference, "env://") {
		return nil, fmt.Errorf("unsupported secret reference")
	}
	value := os.Getenv(strings.TrimPrefix(reference, "env://"))
	if value == "" {
		return nil, fmt.Errorf("secret unavailable")
	}
	return []byte(value), nil
}
func fail(message string) { _, _ = fmt.Fprintln(os.Stderr, message); os.Exit(1) }
