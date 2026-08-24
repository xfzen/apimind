// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	productresourceservice "github.com/xfzen/ecp/server/internal/service/productresource"
	rolebindingservice "github.com/xfzen/ecp/server/internal/service/rolebinding"

	"github.com/zeromicro/go-zero/core/logx"
)

type RevokeRoleBindingLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Revoke a manifest-constrained role binding
func NewRevokeRoleBindingLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RevokeRoleBindingLogic {
	return &RevokeRoleBindingLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RevokeRoleBindingLogic) RevokeRoleBinding(req *types.RoleBindingIDReq) (resp *types.Empty, err error) {
	if req == nil || l.svcCtx.RoleBindings == nil || l.svcCtx.ProductResources == nil {
		return nil, fmt.Errorf("role binding service unavailable")
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.EnterpriseID != req.EnterpriseID || claims.PrincipalID == "" || claims.SessionID == "" {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	binding, err := l.svcCtx.RoleBindings.Get(l.ctx, req.EnterpriseID, req.ApplicationInstanceID, req.BindingID)
	if err != nil {
		return nil, err
	}
	if !canSelfRevoke(binding, claims.PrincipalID) {
		action, actionErr := roleBindingAction(binding.ResourceType)
		if actionErr != nil {
			return nil, actionErr
		}
		resource, resolveErr := l.svcCtx.ProductResources.Resolve(l.ctx, productresourceservice.Actor{EnterpriseID: claims.EnterpriseID, PrincipalID: claims.PrincipalID, SessionID: claims.SessionID}, productresourceservice.ResourceInput{InstanceID: req.ApplicationInstanceID, ResourceType: binding.ResourceType, ResourceID: binding.ResourceID, RequestedAction: action})
		if resolveErr != nil || resource.ResourceType != binding.ResourceType || resource.ExternalID != binding.ResourceID {
			return nil, fmt.Errorf("role_binding_resource_not_visible")
		}
	}
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "role_binding.revoke", ResourceType: binding.ResourceType, ResourceID: binding.ResourceID, SafeDiff: map[string]any{"previous_status": binding.Status, "new_status": "revoked"}}, func() error {
		return l.svcCtx.RoleBindings.Revoke(l.ctx, rolebindingservice.RevokeInput{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, BindingID: req.BindingID})
	})
	if err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}

func canSelfRevoke(binding domain.RoleBinding, principalID string) bool {
	return principalID != "" && binding.SubjectType == "principal" && binding.SubjectID == principalID
}
