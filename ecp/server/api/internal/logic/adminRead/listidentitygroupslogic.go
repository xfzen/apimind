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

type ListIdentityGroupsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List enterprise identity groups
func NewListIdentityGroupsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListIdentityGroupsLogic {
	return &ListIdentityGroupsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListIdentityGroupsLogic) ListIdentityGroups(req *types.AdminEnterpriseReq) (resp *types.GroupListResp, err error) {
	if req == nil || l.svcCtx.AdminQuery == nil {
		return nil, fmt.Errorf("admin query service unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	values, err := l.svcCtx.AdminQuery.ListGroups(l.ctx, enterpriseID)
	if err != nil {
		return nil, err
	}
	resp = &types.GroupListResp{Groups: make([]types.GroupResp, 0, len(values))}
	for _, value := range values {
		resp.Groups = append(resp.Groups, mapGroup(value))
	}
	return resp, nil
}
