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

type ListApplicationsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List registered applications
func NewListApplicationsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListApplicationsLogic {
	return &ListApplicationsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListApplicationsLogic) ListApplications(req *types.AdminEnterpriseReq) (resp *types.ApplicationListResp, err error) {
	if req == nil || l.svcCtx.AdminQuery == nil {
		return nil, fmt.Errorf("admin query service unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	values, err := l.svcCtx.AdminQuery.ListApplications(l.ctx, enterpriseID)
	if err != nil {
		return nil, err
	}
	resp = &types.ApplicationListResp{Applications: make([]types.ApplicationResp, 0, len(values))}
	for _, value := range values {
		resp.Applications = append(resp.Applications, mapApplication(value))
	}
	return resp, nil
}
