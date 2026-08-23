package access

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/internal/domain"
)

type CasdoorEnforcer interface {
	Enforce(context.Context, string, []string) (bool, error)
}
type CasdoorEngine struct{ client CasdoorEnforcer }

func NewCasdoorEngine(client CasdoorEnforcer) *CasdoorEngine { return &CasdoorEngine{client: client} }
func (e *CasdoorEngine) Authorize(ctx context.Context, request domain.AuthorizationRequest) (bool, error) {
	if e == nil || e.client == nil {
		return false, fmt.Errorf("casdoor_enforcer_unavailable")
	}
	subject := request.PolicySubject
	if subject == "" {
		subject = request.PrincipalID
	}
	if request.PermissionID == "" || request.ResourceID == "" {
		return false, fmt.Errorf("policy_binding_missing")
	}
	return e.client.Enforce(ctx, request.PermissionID, []string{subject, request.ResourceID, request.Action})
}
