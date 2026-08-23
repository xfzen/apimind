package adminWrite

import (
	"context"
	"errors"
	"testing"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
)

type auditWriterFixture struct{ events []domain.AuditEvent }

func (w *auditWriterFixture) Append(_ context.Context, event domain.AuditEvent) error {
	w.events = append(w.events, event)
	return nil
}

func TestRunAuditedMutationPersistsIntentAndOutcome(t *testing.T) {
	writer := &auditWriterFixture{}
	service := auditservice.New(nil, writer, nil, nil)
	ctx := apiMiddleware.ContextWithOperationID(context.Background(), "operation-1")
	if err := runAuditedMutation(ctx, service, auditservice.Operation{EnterpriseID: "ent-1", Action: "role_binding.create"}, func() error { return nil }); err != nil {
		t.Fatal(err)
	}
	if len(writer.events) != 2 || writer.events[0].Stage != domain.AuditStageIntent || writer.events[1].Stage != domain.AuditStageOutcome || writer.events[1].Outcome != "succeeded" {
		t.Fatalf("events=%+v", writer.events)
	}
}

func TestRunAuditedMutationRecordsFailure(t *testing.T) {
	writer := &auditWriterFixture{}
	service := auditservice.New(nil, writer, nil, nil)
	ctx := apiMiddleware.ContextWithOperationID(context.Background(), "operation-2")
	expected := errors.New("projection failed")
	err := runAuditedMutation(ctx, service, auditservice.Operation{EnterpriseID: "ent-1", Action: "role_binding.revoke"}, func() error { return expected })
	if !errors.Is(err, expected) || len(writer.events) != 2 || writer.events[1].Outcome != "failed" {
		t.Fatalf("err=%v events=%+v", err, writer.events)
	}
}
