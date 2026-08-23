package machineauth

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/internal/domain"
	credentialservice "github.com/xfzen/ecp/server/internal/service/credential"
)

type CredentialAuthenticator interface {
	Authenticate(context.Context, string, credentialservice.AccessRequest) (credentialservice.Principal, error)
}

type AccessAuthorizer interface {
	Authorize(context.Context, domain.AuthorizationRequest) (domain.AuthorizationDecision, error)
}

type Service struct {
	credentials CredentialAuthenticator
	access      AccessAuthorizer
}

type Boundary struct {
	EnterpriseID, ApplicationID, ApplicationInstanceID string
}

type ResourceRequest struct {
	ResourceType, ResourceID, Action string
	ResourceVersion                  uint64
}

type Result struct {
	PrincipalID string
	Decision    domain.AuthorizationDecision
}

func New(credentials CredentialAuthenticator, access AccessAuthorizer) *Service {
	return &Service{credentials: credentials, access: access}
}

func (s *Service) AuthenticateAndAuthorize(ctx context.Context, boundary Boundary, rawCredential string, request ResourceRequest) (Result, error) {
	if s == nil || s.credentials == nil || s.access == nil || boundary.EnterpriseID == "" || boundary.ApplicationID == "" || boundary.ApplicationInstanceID == "" || rawCredential == "" || request.ResourceType == "" || request.ResourceID == "" || request.Action == "" {
		return Result{}, fmt.Errorf("machine_authorization_invalid")
	}
	principal, err := s.credentials.Authenticate(ctx, rawCredential, credentialservice.AccessRequest{
		EnterpriseID: boundary.EnterpriseID, ApplicationID: boundary.ApplicationID, ApplicationInstanceID: boundary.ApplicationInstanceID,
		ResourceType: request.ResourceType, ResourceID: request.ResourceID, Action: request.Action,
	})
	if err != nil {
		return Result{}, err
	}
	if principal.EnterpriseID != boundary.EnterpriseID || principal.ApplicationID != boundary.ApplicationID || principal.ApplicationInstanceID != boundary.ApplicationInstanceID {
		return Result{}, fmt.Errorf("credential_boundary_mismatch")
	}
	decision, err := s.access.Authorize(ctx, domain.AuthorizationRequest{
		EnterpriseID: boundary.EnterpriseID, ApplicationInstanceID: boundary.ApplicationInstanceID,
		PrincipalID: principal.CredentialID, Action: request.Action, ResourceID: request.ResourceID, ResourceVersion: request.ResourceVersion,
	})
	if err != nil {
		return Result{}, err
	}
	return Result{PrincipalID: principal.CredentialID, Decision: decision}, nil
}
