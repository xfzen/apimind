package connectorMachine

import (
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
)

func authorizationRequest(value types.AuthorizeReq) domain.AuthorizationRequest {
	return domain.AuthorizationRequest{EnterpriseID: value.EnterpriseID, ApplicationInstanceID: value.ApplicationInstanceID, PrincipalID: value.PrincipalID, PrincipalKind: value.PrincipalKind, IdentityProvider: value.IdentityProvider, PolicySubject: value.PolicySubject, DirectGroupIDs: value.DirectGroupIDs, DirectGroupVersion: value.DirectGroupVersion, Action: value.Action, ResourceType: value.ResourceType, ResourceID: value.ResourceID, ResourceVersion: value.ResourceVersion}
}
func decisionResponse(value domain.AuthorizationDecision) types.AuthorizationDecisionResp {
	return types.AuthorizationDecisionResp{Allow: value.Allow, Reason: value.Reason, LifecycleVersion: value.LifecycleVersion, IdentitySyncVersion: value.IdentitySyncVersion, IdentityFreshnessDeadline: value.IdentityFreshnessDeadline.Unix(), PolicyVersion: value.PolicyVersion, AuthorizedResourceVersion: value.AuthorizedResourceVersion, SecurityConfigVersion: value.SecurityConfigVersion}
}
