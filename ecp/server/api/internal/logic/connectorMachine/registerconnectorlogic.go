// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"

	"github.com/zeromicro/go-zero/core/logx"
)

type RegisterConnectorLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Register a product connector
func NewRegisterConnectorLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RegisterConnectorLogic {
	return &RegisterConnectorLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RegisterConnectorLogic) RegisterConnector(req *types.RegisterConnectorReq) (resp *types.ConnectorResp, err error) {
	if req == nil || l.svcCtx.Registry == nil {
		return nil, fmt.Errorf("registry is unavailable")
	}
	value, err := l.svcCtx.Registry.RegisterConnector(l.ctx, registryservice.RegisterConnectorInput{
		EnterpriseID: req.EnterpriseID, ApplicationID: req.ApplicationID, InstanceID: req.InstanceID, ConnectorKey: req.ConnectorKey,
	})
	if err != nil {
		return nil, err
	}
	return &types.ConnectorResp{ID: value.ID, EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, InstanceID: value.InstanceID, ConnectorKey: value.ConnectorKey, Status: value.Status, Version: value.Version}, nil
}
