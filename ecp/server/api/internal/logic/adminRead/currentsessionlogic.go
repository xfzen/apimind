// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type CurrentSessionLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Current admin session
func NewCurrentSessionLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CurrentSessionLogic {
	return &CurrentSessionLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CurrentSessionLogic) CurrentSession() (resp *types.SessionSummaryResp, err error) {
	claims, ok := apiMiddleware.ClaimsFromContext(l.ctx)
	if !ok {
		return nil, fmt.Errorf("admin_session_required")
	}
	return &types.SessionSummaryResp{ID: claims.SessionID, EnterpriseID: claims.EnterpriseID, PrincipalID: claims.PrincipalID, Kind: "admin", ExpiresAt: claims.ExpiresAt.Unix()}, nil
}
