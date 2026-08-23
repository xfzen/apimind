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

type CreateRoleBindingLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Create a manifest-constrained role binding
func NewCreateRoleBindingLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateRoleBindingLogic {
	return &CreateRoleBindingLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateRoleBindingLogic) CreateRoleBinding(req *types.RoleBindingReq) (resp *types.RoleBindingResp, err error) {
	if req == nil || l.svcCtx.RoleBindings == nil || l.svcCtx.ProductResources == nil {
		return nil, fmt.Errorf("role binding service unavailable")
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.EnterpriseID != req.EnterpriseID || claims.PrincipalID == "" || claims.SessionID == "" {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	action, err := roleBindingAction(req.Resource.Type)
	if err != nil {
		return nil, err
	}
	resource, err := l.svcCtx.ProductResources.Resolve(l.ctx, productresourceservice.Actor{EnterpriseID: claims.EnterpriseID, PrincipalID: claims.PrincipalID, SessionID: claims.SessionID}, productresourceservice.ResourceInput{InstanceID: req.ApplicationInstanceID, ResourceType: req.Resource.Type, ResourceID: req.Resource.ID, RequestedAction: action})
	if err != nil || resource.ResourceType != req.Resource.Type || resource.ExternalID != req.Resource.ID {
		return nil, fmt.Errorf("role_binding_resource_not_visible")
	}
	var value domain.RoleBinding
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "role_binding.create", ResourceType: req.Resource.Type, ResourceID: req.Resource.ID, SafeDiff: map[string]any{"status": "active"}}, func() error {
		var createErr error
		value, createErr = l.svcCtx.RoleBindings.Create(l.ctx, rolebindingservice.CreateInput{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, SubjectType: req.SubjectType, SubjectID: req.SubjectID, RoleID: req.Role, ResourceType: req.Resource.Type, ResourceID: req.Resource.ID})
		return createErr
	})
	if err != nil {
		return nil, err
	}
	return &types.RoleBindingResp{ID: value.ID, SubjectType: value.SubjectType, SubjectID: value.SubjectID, Role: value.RoleID, Resource: types.RoleBindingResource{Type: value.ResourceType, ID: value.ResourceID}, Status: value.Status}, nil
}

func roleBindingAction(resourceType string) (string, error) {
	switch resourceType {
	case "workspace":
		return "workspace.member.manage", nil
	case "project":
		return "project.member.manage", nil
	default:
		return "", fmt.Errorf("role_binding_resource_type_unsupported")
	}
}
