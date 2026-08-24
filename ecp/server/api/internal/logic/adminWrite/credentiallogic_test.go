package adminWrite

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	credentialservice "github.com/xfzen/ecp/server/internal/service/credential"
	"github.com/xfzen/ecp/server/internal/service/session"
)

type credentialStoreFixture struct {
	values map[string]domain.ServiceCredential
}

func (s *credentialStoreFixture) Create(_ context.Context, value domain.ServiceCredential) error {
	s.values[value.ID] = value
	return nil
}
func (s *credentialStoreFixture) Get(_ context.Context, id string) (domain.ServiceCredential, bool, error) {
	value, ok := s.values[id]
	return value, ok, nil
}
func (s *credentialStoreFixture) Update(_ context.Context, value domain.ServiceCredential) error {
	s.values[value.ID] = value
	return nil
}
func (s *credentialStoreFixture) ListUsage(context.Context, string, string) ([]domain.ServiceCredential, error) {
	return nil, nil
}

type adminSessionFixture struct{}

func (adminSessionFixture) Resolve(context.Context, string, string) (domain.Session, error) {
	return domain.Session{Base: domain.Base{ID: "session-1", EnterpriseID: "enterprise-1"}, PrincipalID: "principal-1", CSRFHash: "csrf", ExpiresAt: time.Now().Add(time.Hour)}, nil
}

func TestCreateCredentialWritesAuditedIntentAndOutcome(t *testing.T) {
	writer := &auditWriterFixture{}
	serviceContext := &svc.ServiceContext{
		Credential: credentialservice.New(&credentialStoreFixture{values: map[string]domain.ServiceCredential{}}, credentialservice.Config{}),
		Audit:      auditservice.New(nil, writer, nil, nil),
	}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/credentials", nil)
	request.AddCookie(&http.Cookie{Name: session.AdminCookieName, Value: "session-token"})
	response := httptest.NewRecorder()
	var logicErr error
	var created *types.CredentialResp
	handler := apiMiddleware.NewAdminSession(adminSessionFixture{}).Handle(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		ctx := apiMiddleware.ContextWithOperationID(request.Context(), "operation-credential-create")
		created, logicErr = NewCreateCredentialLogic(ctx, serviceContext).CreateCredential(&types.CreateCredentialReq{
			EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-1", Name: "automation",
			Scopes: []types.CredentialScopeItem{{ResourceType: "workspace", ResourceID: "14", Actions: []string{"workspace.read"}}}, LifetimeSeconds: 3600,
		})
	}))
	handler.ServeHTTP(response, request)
	if logicErr != nil {
		t.Fatal(logicErr)
	}
	if len(writer.events) != 2 || writer.events[0].Action != "credential.create" || writer.events[1].Outcome != "succeeded" {
		t.Fatalf("events=%+v", writer.events)
	}
	rotateRequest := httptest.NewRequest(http.MethodPost, "/api/v1/credentials/"+created.ID+"/rotate", nil)
	rotateRequest.AddCookie(&http.Cookie{Name: session.AdminCookieName, Value: "session-token"})
	rotateHandler := apiMiddleware.NewAdminSession(adminSessionFixture{}).Handle(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		ctx := apiMiddleware.ContextWithOperationID(request.Context(), "operation-credential-rotate")
		_, logicErr = NewRotateCredentialLogic(ctx, serviceContext).RotateCredential(&types.RotateCredentialReq{ID: created.ID, Reason: "scheduled rotation", LifetimeSeconds: 3600})
	}))
	rotateHandler.ServeHTTP(httptest.NewRecorder(), rotateRequest)
	if logicErr != nil {
		t.Fatal(logicErr)
	}
	if len(writer.events) != 4 || writer.events[2].Action != "credential.rotate" || writer.events[3].Outcome != "succeeded" || !strings.Contains(string(writer.events[2].SafeDiff), "scheduled rotation") {
		t.Fatalf("events=%+v", writer.events)
	}
}
