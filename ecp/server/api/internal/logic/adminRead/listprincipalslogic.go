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

type ListPrincipalsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List enterprise principals
func NewListPrincipalsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListPrincipalsLogic {
	return &ListPrincipalsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListPrincipalsLogic) ListPrincipals(req *types.AdminEnterpriseReq) (resp *types.PrincipalListResp, err error) {
	if req == nil || l.svcCtx.AdminQuery == nil {
		return nil, fmt.Errorf("admin query service unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	values, err := l.svcCtx.AdminQuery.ListPrincipals(l.ctx, enterpriseID)
	if err != nil {
		return nil, err
	}
	resp = &types.PrincipalListResp{Principals: make([]types.PrincipalResp, 0, len(values))}
	for _, value := range values {
		resp.Principals = append(resp.Principals, mapPrincipal(value))
	}
	return resp, nil
}
