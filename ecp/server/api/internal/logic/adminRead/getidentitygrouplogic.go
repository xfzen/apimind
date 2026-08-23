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

type GetIdentityGroupLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get one enterprise identity group
func NewGetIdentityGroupLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetIdentityGroupLogic {
	return &GetIdentityGroupLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetIdentityGroupLogic) GetIdentityGroup(req *types.AdminEntityReq) (resp *types.GroupDetailResp, err error) {
	if req == nil || l.svcCtx.AdminQuery == nil {
		return nil, fmt.Errorf("admin query service unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	value, err := l.svcCtx.AdminQuery.GetGroup(l.ctx, enterpriseID, req.ID)
	if err != nil {
		return nil, err
	}
	return &types.GroupDetailResp{Group: mapGroup(value.Group), PrincipalIDs: value.PrincipalIDs}, nil
}
