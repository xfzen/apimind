// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type RevokeSessionLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Revoke an admin session
func NewRevokeSessionLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RevokeSessionLogic {
	return &RevokeSessionLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RevokeSessionLogic) RevokeSession(req *types.RevokeSessionReq) (resp *types.Empty, err error) {
	if req == nil || l.svcCtx.Sessions == nil {
		return nil, fmt.Errorf("session service is unavailable")
	}
	claims, ok := apiMiddleware.ClaimsFromContext(l.ctx)
	if !ok || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	if err := l.svcCtx.Sessions.Revoke(l.ctx, req.EnterpriseID, req.SessionID); err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}
