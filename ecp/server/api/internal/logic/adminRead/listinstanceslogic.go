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

type ListInstancesLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List registered application instances
func NewListInstancesLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListInstancesLogic {
	return &ListInstancesLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListInstancesLogic) ListInstances(req *types.InstanceListReq) (resp *types.InstanceListResp, err error) {
	if req == nil || l.svcCtx.AdminQuery == nil {
		return nil, fmt.Errorf("admin query service unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	values, err := l.svcCtx.AdminQuery.ListInstances(l.ctx, enterpriseID, req.ApplicationID)
	if err != nil {
		return nil, err
	}
	resp = &types.InstanceListResp{Instances: make([]types.InstanceResp, 0, len(values))}
	for _, value := range values {
		resp.Instances = append(resp.Instances, mapInstance(value))
	}
	return resp, nil
}
