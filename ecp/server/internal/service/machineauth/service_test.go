package machineauth

import (
	"context"
	"errors"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
	credentialservice "github.com/xfzen/ecp/server/internal/service/credential"
)

type fakeCredentialAuthenticator struct {
	principal credentialservice.Principal
	err       error
	raw       string
	request   credentialservice.AccessRequest
}

func (a *fakeCredentialAuthenticator) Authenticate(_ context.Context, raw string, request credentialservice.AccessRequest) (credentialservice.Principal, error) {
	a.raw = raw
	a.request = request
	return a.principal, a.err
}

type fakeAccessAuthorizer struct {
	decision domain.AuthorizationDecision
	err      error
	request  domain.AuthorizationRequest
}

func (a *fakeAccessAuthorizer) Authorize(_ context.Context, request domain.AuthorizationRequest) (domain.AuthorizationDecision, error) {
	a.request = request
	return a.decision, a.err
}

func TestAuthenticateAndAuthorizeUsesConnectorBoundaryThenSharedAccessService(t *testing.T) {
	credentials := &fakeCredentialAuthenticator{principal: credentialservice.Principal{CredentialID: "cred-1", EnterpriseID: "ent-1", ApplicationID: "apimind", ApplicationInstanceID: "ins-1"}}
	access := &fakeAccessAuthorizer{decision: domain.AuthorizationDecision{Allow: true, Reason: "allowed", PolicyVersion: 3}}
	service := New(credentials, access)
	result, err := service.AuthenticateAndAuthorize(context.Background(), Boundary{EnterpriseID: "ent-1", ApplicationID: "apimind", ApplicationInstanceID: "ins-1"}, "cred-1.secret", ResourceRequest{ResourceType: "project", ResourceID: "project-1", Action: "project.read", ResourceVersion: 7})
	if err != nil {
		t.Fatal(err)
	}
	if credentials.raw != "cred-1.secret" || credentials.request.EnterpriseID != "ent-1" || credentials.request.ApplicationID != "apimind" || credentials.request.ApplicationInstanceID != "ins-1" || credentials.request.ResourceType != "project" || credentials.request.ResourceID != "project-1" || credentials.request.Action != "project.read" {
		t.Fatalf("credential request=%+v raw=%q", credentials.request, credentials.raw)
	}
	if access.request.PrincipalID != "cred-1" || access.request.EnterpriseID != "ent-1" || access.request.ApplicationInstanceID != "ins-1" || access.request.ResourceID != "project-1" || access.request.Action != "project.read" || access.request.ResourceVersion != 7 {
		t.Fatalf("access request=%+v", access.request)
	}
	if result.PrincipalID != "cred-1" || !result.Decision.Allow || result.Decision.PolicyVersion != 3 {
		t.Fatalf("result=%+v", result)
	}
}

func TestCredentialFailureDoesNotCallAccessService(t *testing.T) {
	credentials := &fakeCredentialAuthenticator{err: errors.New("credential invalid")}
	access := &fakeAccessAuthorizer{}
	service := New(credentials, access)
	_, err := service.AuthenticateAndAuthorize(context.Background(), Boundary{EnterpriseID: "ent-1", ApplicationID: "apimind", ApplicationInstanceID: "ins-1"}, "bad", ResourceRequest{ResourceType: "project", ResourceID: "project-1", Action: "project.read"})
	if err == nil {
		t.Fatal("expected credential failure")
	}
	if access.request.PrincipalID != "" {
		t.Fatalf("access called after credential failure: %+v", access.request)
	}
}

func TestMismatchedCredentialBoundaryFailsClosed(t *testing.T) {
	credentials := &fakeCredentialAuthenticator{principal: credentialservice.Principal{CredentialID: "cred-1", EnterpriseID: "other", ApplicationID: "apimind", ApplicationInstanceID: "ins-1"}}
	access := &fakeAccessAuthorizer{}
	service := New(credentials, access)
	_, err := service.AuthenticateAndAuthorize(context.Background(), Boundary{EnterpriseID: "ent-1", ApplicationID: "apimind", ApplicationInstanceID: "ins-1"}, "cred-1.secret", ResourceRequest{ResourceType: "project", ResourceID: "project-1", Action: "project.read"})
	if err == nil || err.Error() != "credential_boundary_mismatch" {
		t.Fatalf("err=%v", err)
	}
	if access.request.PrincipalID != "" {
		t.Fatalf("access called after boundary mismatch: %+v", access.request)
	}
}
