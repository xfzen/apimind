// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"

	"github.com/zeromicro/go-zero/core/logx"
)

type RegisterInstanceLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Register an application instance
func NewRegisterInstanceLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RegisterInstanceLogic {
	return &RegisterInstanceLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RegisterInstanceLogic) RegisterInstance(req *types.RegisterInstanceReq) (resp *types.InstanceResp, err error) {
	if req == nil || l.svcCtx.Registry == nil {
		return nil, fmt.Errorf("registry is unavailable")
	}
	enterpriseID, scopeErr := requireEnterprise(l.ctx, req.EnterpriseID)
	if scopeErr != nil {
		return nil, scopeErr
	}
	value, err := l.svcCtx.Registry.RegisterInstance(l.ctx, registryservice.RegisterInstanceInput{
		EnterpriseID: enterpriseID, ApplicationID: req.ApplicationID, InstanceKey: req.InstanceKey,
		Environment: req.Environment, CanonicalURL: req.CanonicalURL,
	})
	if err != nil {
		return nil, err
	}
	return &types.InstanceResp{ID: value.ID, EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, InstanceKey: value.InstanceKey, Environment: value.Environment, CanonicalURL: value.CanonicalURL, Status: value.Status, Version: value.Version}, nil
}
