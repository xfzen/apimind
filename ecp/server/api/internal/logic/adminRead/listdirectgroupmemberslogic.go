// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type ListDirectGroupMembersLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List direct group members
func NewListDirectGroupMembersLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListDirectGroupMembersLogic {
	return &ListDirectGroupMembersLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListDirectGroupMembersLogic) ListDirectGroupMembers(req *types.ListGroupMembersReq) (resp *types.GroupMembersResp, err error) {
	if req == nil || l.svcCtx.Identity == nil {
		return nil, fmt.Errorf("identity service is unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	values, err := l.svcCtx.Identity.ListDirectGroupMembers(l.ctx, enterpriseID, req.GroupID)
	if err != nil {
		return nil, err
	}
	return &types.GroupMembersResp{PrincipalIDs: values}, nil
}
