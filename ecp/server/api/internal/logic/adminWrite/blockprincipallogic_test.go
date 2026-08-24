package adminWrite

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	lifecycleservice "github.com/xfzen/ecp/server/internal/service/lifecycle"
	"github.com/xfzen/ecp/server/internal/service/session"
)

type lifecycleStoreFixture struct {
	lifecycles map[string]domain.PrincipalLifecycle
}

func (s *lifecycleStoreFixture) GetLifecycle(_ context.Context, enterpriseID, principalID string) (domain.PrincipalLifecycle, bool, error) {
	value, ok := s.lifecycles[enterpriseID+"/"+principalID]
	return value, ok, nil
}
func (s *lifecycleStoreFixture) PutLifecycle(_ context.Context, value domain.PrincipalLifecycle) error {
	s.lifecycles[value.EnterpriseID+"/"+value.PrincipalID] = value
	return nil
}
func (*lifecycleStoreFixture) GetSyncState(context.Context, string, string) (domain.IdentitySyncState, bool, error) {
	return domain.IdentitySyncState{}, false, nil
}
func (*lifecycleStoreFixture) PutSyncState(context.Context, domain.IdentitySyncState) error {
	return nil
}

func TestBlockPrincipalWritesAuditedIntentAndOutcome(t *testing.T) {
	writer := &auditWriterFixture{}
	serviceContext := &svc.ServiceContext{Lifecycle: lifecycleservice.New(&lifecycleStoreFixture{lifecycles: map[string]domain.PrincipalLifecycle{}}, nil, time.Minute), Audit: auditservice.New(nil, writer, nil, nil)}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/identity/principals/principal-2/block", nil)
	request.AddCookie(&http.Cookie{Name: session.AdminCookieName, Value: "session-token"})
	response := httptest.NewRecorder()
	var logicErr error
	handler := apiMiddleware.NewAdminSession(adminSessionFixture{}).Handle(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		ctx := apiMiddleware.ContextWithOperationID(request.Context(), "operation-principal-block")
		_, logicErr = NewBlockPrincipalLogic(ctx, serviceContext).BlockPrincipal(&types.BlockPrincipalReq{EnterpriseID: "enterprise-1", PrincipalID: "principal-2"})
	}))
	handler.ServeHTTP(response, request)
	if logicErr != nil {
		t.Fatal(logicErr)
	}
	if len(writer.events) != 2 || writer.events[0].Action != "principal.block" || writer.events[1].Outcome != "succeeded" {
		t.Fatalf("events=%+v", writer.events)
	}
}
