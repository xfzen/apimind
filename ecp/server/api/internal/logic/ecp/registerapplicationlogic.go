// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package ecp

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"

	"github.com/zeromicro/go-zero/core/logx"
)

type RegisterApplicationLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Register an application
func NewRegisterApplicationLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RegisterApplicationLogic {
	return &RegisterApplicationLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RegisterApplicationLogic) RegisterApplication(req *types.RegisterApplicationReq) (resp *types.ApplicationResp, err error) {
	if req == nil || l.svcCtx.Registry == nil {
		return nil, fmt.Errorf("registry is unavailable")
	}
	value, err := l.svcCtx.Registry.RegisterApplication(l.ctx, registryservice.RegisterApplicationInput{
		ID: req.ID, EnterpriseID: req.EnterpriseID, Key: req.Key, Name: req.Name,
	})
	if err != nil {
		return nil, err
	}
	return &types.ApplicationResp{ID: value.ID, EnterpriseID: value.EnterpriseID, Key: value.Key, Name: value.Name, Status: value.Status, Version: value.Version}, nil
}
