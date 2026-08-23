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

type ListSessionsLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List admin sessions
func NewListSessionsLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListSessionsLogic {
	return &ListSessionsLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListSessionsLogic) ListSessions(req *types.SessionListReq) (resp *types.SessionListResp, err error) {
	if req == nil || l.svcCtx.Sessions == nil {
		return nil, fmt.Errorf("session service is unavailable")
	}
	claims, ok := apiMiddleware.ClaimsFromContext(l.ctx)
	if !ok || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	values, err := l.svcCtx.Sessions.List(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	resp = &types.SessionListResp{Sessions: make([]types.SessionSummaryResp, 0, len(values))}
	for _, value := range values {
		resp.Sessions = append(resp.Sessions, sessionSummary(value))
	}
	return resp, nil
}
