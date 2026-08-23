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

type LogoutLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// End the current admin session
func NewLogoutLogic(ctx context.Context, svcCtx *svc.ServiceContext) *LogoutLogic {
	return &LogoutLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *LogoutLogic) Logout() (resp *types.Empty, err error) {
	if l.svcCtx.Sessions == nil {
		return nil, fmt.Errorf("session service is unavailable")
	}
	claims, ok := apiMiddleware.ClaimsFromContext(l.ctx)
	if !ok {
		return nil, fmt.Errorf("admin_session_required")
	}
	if err := l.svcCtx.Sessions.Revoke(l.ctx, claims.EnterpriseID, claims.SessionID); err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}
