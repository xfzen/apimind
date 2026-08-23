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

type RevokeProductSessionLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Revoke a product session by its opaque token
func NewRevokeProductSessionLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RevokeProductSessionLogic {
	return &RevokeProductSessionLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RevokeProductSessionLogic) RevokeProductSession(req *types.RevokeProductSessionReq) (resp *types.Empty, err error) {
	if req == nil || l.svcCtx.Sessions == nil {
		return nil, fmt.Errorf("session service is unavailable")
	}
	claims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found || !hasScope(claims.Scopes, "session.resolve") || claims.ApplicationInstanceID != req.InstanceID {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	if err := l.svcCtx.Sessions.RevokeProductSession(l.ctx, claims.EnterpriseID, claims.ApplicationInstanceID, req.SessionToken); err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}
