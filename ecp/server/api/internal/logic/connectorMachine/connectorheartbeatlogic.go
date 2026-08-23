// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type ConnectorHeartbeatLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Report product Connector health
func NewConnectorHeartbeatLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ConnectorHeartbeatLogic {
	return &ConnectorHeartbeatLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ConnectorHeartbeatLogic) ConnectorHeartbeat(req *types.ConnectorHeartbeatReq) (resp *types.ConnectorHeartbeatResp, err error) {
	if req == nil {
		return nil, fmt.Errorf("heartbeat request required")
	}
	claims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found || !hasScope(claims.Scopes, "heartbeat.write") || claims.ApplicationInstanceID != req.InstanceID {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	return &types.ConnectorHeartbeatResp{Accepted: true}, nil
}
