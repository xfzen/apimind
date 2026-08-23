package operation

import (
	"context"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
)

type operationFixture struct {
	calls []string
	state string
}

func (f *operationFixture) LoadExportData(context.Context, string, string) (ExportData, error) {
	f.calls = append(f.calls, "export")
	return ExportData{Enterprise: EnterpriseMetadata{ID: "ent-1"}, Instance: InstanceMetadata{ID: "ins-1"}}, nil
}
func (*operationFixture) LatestBackup(context.Context, string) (domain.BackupOperation, bool, error) {
	return domain.BackupOperation{}, false, nil
}
func (*operationFixture) RecordBackup(context.Context, domain.BackupOperation) error { return nil }
func (f *operationFixture) BeginOffboarding(context.Context, string, string) (string, error) {
	f.calls = append(f.calls, "block")
	if f.state != "" {
		return f.state, nil
	}
	return "offboarding", nil
}
func (f *operationFixture) RevokeProductSessions(context.Context, string, string) (int64, error) {
	f.calls = append(f.calls, "sessions")
	return 2, nil
}
func (f *operationFixture) RevokeInstanceCredentials(context.Context, string, string) (int64, error) {
	f.calls = append(f.calls, "credentials")
	return 3, nil
}
func (f *operationFixture) FinalLifecycleVersion(context.Context, string) (uint64, error) {
	f.calls = append(f.calls, "lifecycle")
	return 8, nil
}
func (f *operationFixture) DisableConnector(context.Context, string, string) error {
	f.calls = append(f.calls, "disable")
	return nil
}
func (f *operationFixture) FlushProductAudit(context.Context, string, string) error {
	f.calls = append(f.calls, "flush")
	return nil
}
func (*operationFixture) ExportManifest(context.Context, auditservice.Query) (auditservice.ExportManifest, error) {
	return auditservice.ExportManifest{Version: 1}, nil
}

func TestOffboardRevokesSessionsAndCredentialsBeforeDisconnect(t *testing.T) {
	fixture := &operationFixture{}
	service := New(fixture, fixture, fixture, fixture)
	service.now = func() time.Time { return time.Unix(10, 0).UTC() }
	result, err := service.OffboardInstance(context.Background(), "ent-1", "ins-1")
	if err != nil {
		t.Fatal(err)
	}
	if !result.SessionsRevoked || !result.CredentialsRevoked || !result.ExportVerified || !result.AuditFlushed || !result.ConnectorDisabled || result.FinalLifecycleVersion != 8 {
		t.Fatalf("unsafe offboard result: %+v", result)
	}
	want := []string{"export", "block", "sessions", "credentials", "flush", "lifecycle", "disable"}
	if len(fixture.calls) != len(want) {
		t.Fatalf("calls=%v", fixture.calls)
	}
	for index := range want {
		if fixture.calls[index] != want[index] {
			t.Fatalf("calls=%v want=%v", fixture.calls, want)
		}
	}
}

func TestBackupStatusNeverInfersSuccessWithoutRecord(t *testing.T) {
	fixture := &operationFixture{}
	status, err := New(fixture, fixture, fixture, fixture).BackupStatus(context.Background(), "ent-1")
	if err != nil || status.State != "never_run" {
		t.Fatalf("status=%+v err=%v", status, err)
	}
}

func TestOffboardRetryAfterCompletedDisableIsIdempotent(t *testing.T) {
	fixture := &operationFixture{state: "disabled"}
	result, err := New(fixture, fixture, fixture, fixture).OffboardInstance(context.Background(), "ent-1", "ins-1")
	if err != nil {
		t.Fatal(err)
	}
	if !result.ExportVerified || !result.SessionsRevoked || !result.CredentialsRevoked || !result.AuditFlushed || !result.ConnectorDisabled {
		t.Fatalf("completed retry was not idempotent: %+v", result)
	}
	want := []string{"export", "block", "lifecycle"}
	if len(fixture.calls) != len(want) {
		t.Fatalf("calls=%v", fixture.calls)
	}
	for index := range want {
		if fixture.calls[index] != want[index] {
			t.Fatalf("calls=%v want=%v", fixture.calls, want)
		}
	}
}
