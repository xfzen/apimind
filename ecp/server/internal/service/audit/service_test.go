package audit

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type memoryWriter struct{ events []domain.AuditEvent }

func (w *memoryWriter) Append(_ context.Context, value domain.AuditEvent) error {
	w.events = append(w.events, value)
	return nil
}

type fixedClock struct{ now time.Time }

func (c fixedClock) Now() time.Time { return c.now }

func TestIntentAndOutcomeUseAppendOnlyStages(t *testing.T) {
	writer := &memoryWriter{}
	service := New(nil, writer, nil, fixedClock{now: time.Date(2026, 8, 24, 2, 0, 0, 0, time.UTC)})
	operation := Operation{ID: "operation-1", EnterpriseID: "enterprise-1", ActorID: "principal-1", ActorKind: "human", Action: "credential.rotate", ResourceType: "credential", ResourceID: "credential-1", SafeDiff: map[string]any{"status": "rotating"}}
	if err := service.Intent(context.Background(), operation); err != nil {
		t.Fatal(err)
	}
	if err := service.Outcome(context.Background(), operation, "success", ""); err != nil {
		t.Fatal(err)
	}
	if len(writer.events) != 2 || writer.events[0].Stage != domain.AuditStageIntent || writer.events[1].Stage != domain.AuditStageOutcome {
		t.Fatalf("events = %+v", writer.events)
	}
}

func TestSafeDiffRedactsSensitiveAndDocumentFields(t *testing.T) {
	value := SanitizeDiff(map[string]any{"status": "active", "token": "secret", "cookie": "secret", "private_key": "secret", "document_body": "contents", "interface_body": "contents", "name": "ApiMind"})
	if value["status"] != "active" || value["name"] != "ApiMind" {
		t.Fatalf("allowed fields lost: %+v", value)
	}
	for _, forbidden := range []string{"token", "cookie", "private_key", "document_body", "interface_body"} {
		if _, found := value[forbidden]; found {
			t.Fatalf("%s leaked", forbidden)
		}
	}
	encoded := string(CanonicalJSON(value))
	if strings.Contains(encoded, "secret") || strings.Contains(encoded, "contents") {
		t.Fatalf("sensitive value leaked: %s", encoded)
	}
}

func TestProductIngestRejectsUnsafeDiffAndWrongInstance(t *testing.T) {
	writer := &memoryWriter{}
	service := New(nil, writer, nil, fixedClock{now: time.Now().UTC()})
	err := service.Ingest(context.Background(), IngestRequest{EnterpriseID: "enterprise-1", ApplicationInstanceID: "instance-a", AuthenticatedInstanceID: "instance-b", Events: []ProductEvent{{OperationID: "op", Action: "project.read"}}})
	if reason(err) != "audit_instance_mismatch" {
		t.Fatalf("reason=%q", reason(err))
	}
	err = service.Ingest(context.Background(), IngestRequest{EnterpriseID: "enterprise-1", ApplicationInstanceID: "instance-a", AuthenticatedInstanceID: "instance-a", Events: []ProductEvent{{OperationID: "op", Action: "project.read", SafeDiff: map[string]any{"token": "raw"}}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(writer.events) != 1 || strings.Contains(string(writer.events[0].SafeDiff), "raw") {
		t.Fatalf("unsafe event = %+v", writer.events)
	}
}
