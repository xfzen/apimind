package connectorMachine

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	credentialservice "github.com/xfzen/ecp/server/internal/service/credential"
	machineauthservice "github.com/xfzen/ecp/server/internal/service/machineauth"
)

type connectorVerifierFixture struct{ claims apiMiddleware.ConnectorClaims }

func (v connectorVerifierFixture) VerifyConnectorCredential(context.Context, string, string) (apiMiddleware.ConnectorClaims, error) {
	return v.claims, nil
}

type machineCredentialFixture struct{ called bool }

func (f *machineCredentialFixture) Authenticate(_ context.Context, _ string, _ credentialservice.AccessRequest) (credentialservice.Principal, error) {
	f.called = true
	return credentialservice.Principal{CredentialID: "cred-1", EnterpriseID: "ent-1", ApplicationID: "apimind", ApplicationInstanceID: "ins-1"}, nil
}

type machineAccessFixture struct{}

func (machineAccessFixture) Authorize(context.Context, domain.AuthorizationRequest) (domain.AuthorizationDecision, error) {
	return domain.AuthorizationDecision{Allow: true, Reason: "allowed", PolicyVersion: 2}, nil
}

func TestAuthenticateServiceCredentialRequiresDedicatedConnectorScope(t *testing.T) {
	for _, test := range []struct {
		name       string
		scopes     []string
		wantErr    string
		wantCalled bool
	}{
		{name: "missing scope", scopes: []string{"access.authorize"}, wantErr: "connector_scope_denied"},
		{name: "dedicated scope", scopes: []string{"service_credential.authenticate"}, wantCalled: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			credentials := &machineCredentialFixture{}
			serviceContext := &svc.ServiceContext{MachineAuth: machineauthservice.New(credentials, machineAccessFixture{})}
			claims := apiMiddleware.ConnectorClaims{ConnectorID: "connector-1", EnterpriseID: "ent-1", ApplicationID: "apimind", ApplicationInstanceID: "ins-1", Scopes: test.scopes}
			var logicErr error
			var response *types.AuthenticateServiceCredentialResp
			next := http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
				response, logicErr = NewAuthenticateServiceCredentialLogic(request.Context(), serviceContext).AuthenticateServiceCredential(&types.AuthenticateServiceCredentialReq{Credential: "cred-1.secret", ResourceType: "project", ResourceID: "project-1", Action: "project.read", ResourceVersion: 1})
			})
			handler := apiMiddleware.NewConnectorMachine(connectorVerifierFixture{claims: claims}).Handle(next)
			request := httptest.NewRequest(http.MethodPost, "/api/v1/connector/service-credentials/authenticate", nil)
			request.Header.Set("X-ECP-Connector-ID", "connector-1")
			request.Header.Set("Authorization", "Bearer connector-secret")
			handler.ServeHTTP(httptest.NewRecorder(), request)
			if test.wantErr != "" {
				if logicErr == nil || logicErr.Error() != test.wantErr {
					t.Fatalf("err=%v", logicErr)
				}
			} else if logicErr != nil || response == nil || response.PrincipalID != "cred-1" || !response.Decision.Allow {
				t.Fatalf("response=%+v err=%v", response, logicErr)
			}
			if credentials.called != test.wantCalled {
				t.Fatalf("credential called=%v", credentials.called)
			}
		})
	}
}
