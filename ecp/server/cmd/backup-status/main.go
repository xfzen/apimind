package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/xfzen/ecp/server/config"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	operationservice "github.com/xfzen/ecp/server/internal/service/operation"
)

func main() {
	driver := flag.String("driver", "", "database driver")
	dsnFile := flag.String("dsn-file", "", "file containing runtime DSN")
	enterpriseID := flag.String("enterprise", "", "enterprise ID")
	backupID := flag.String("backup", "", "backup ID")
	state := flag.String("state", "", "in_progress, failed, completed, or verified")
	manifestHash := flag.String("manifest-hash", "", "verified manifest SHA-256")
	reason := flag.String("reason", "", "safe failure reason")
	started := flag.String("started-at", "", "RFC3339 start time")
	flag.Parse()
	startedAt, err := time.Parse(time.RFC3339, *started)
	if err != nil {
		fatalf("invalid started-at: %v", err)
	}
	db, err := persistence.Open(config.DatabaseConfig{Enabled: true, Driver: *driver, DSNFile: *dsnFile})
	if err != nil {
		fatalf("%v", err)
	}
	service := operationservice.New(persistence.NewOperationStore(db), nil, nil, nil)
	now := time.Now().UTC()
	input := operationservice.RecordBackupInput{EnterpriseID: *enterpriseID, BackupID: *backupID, State: *state, ManifestHash: *manifestHash, FailureReason: *reason, StartedAt: startedAt}
	if *state == "completed" || *state == "verified" || *state == "failed" {
		input.CompletedAt = now
	}
	if *state == "verified" {
		input.VerifiedAt = now
	}
	if err := service.RecordBackup(context.Background(), input); err != nil {
		fatalf("%v", err)
	}
}

func fatalf(format string, values ...any) {
	_, _ = fmt.Fprintf(os.Stderr, format+"\n", values...)
	os.Exit(1)
}
