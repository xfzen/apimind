// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type ListRoleBindingsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List role bindings for one application instance
func NewListRoleBindingsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListRoleBindingsLogic {
	return &ListRoleBindingsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListRoleBindingsLogic) ListRoleBindings(req *types.RoleBindingListReq) (resp *types.RoleBindingListResp, err error) {
	if req == nil || l.svcCtx.RoleBindings == nil {
		return nil, fmt.Errorf("role binding service unavailable")
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	values, err := l.svcCtx.RoleBindings.List(l.ctx, req.EnterpriseID, req.ApplicationInstanceID)
	if err != nil {
		return nil, err
	}
	resp = &types.RoleBindingListResp{Items: make([]types.RoleBindingResp, len(values))}
	for index, value := range values {
		resp.Items[index] = types.RoleBindingResp{ID: value.ID, SubjectType: value.SubjectType, SubjectID: value.SubjectID, Role: value.RoleID, Resource: types.RoleBindingResource{Type: value.ResourceType, ID: value.ResourceID}, Status: value.Status}
	}
	return resp, nil
}
