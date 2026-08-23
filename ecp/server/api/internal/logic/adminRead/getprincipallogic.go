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

type GetPrincipalLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get one enterprise principal
func NewGetPrincipalLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetPrincipalLogic {
	return &GetPrincipalLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetPrincipalLogic) GetPrincipal(req *types.AdminEntityReq) (resp *types.PrincipalResp, err error) {
	if req == nil || l.svcCtx.AdminQuery == nil {
		return nil, fmt.Errorf("admin query service unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	value, err := l.svcCtx.AdminQuery.GetPrincipal(l.ctx, enterpriseID, req.ID)
	if err != nil {
		return nil, err
	}
	result := mapPrincipal(value)
	return &result, nil
}
