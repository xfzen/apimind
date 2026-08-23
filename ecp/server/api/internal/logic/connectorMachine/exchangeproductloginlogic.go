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

type ExchangeProductLoginLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Exchange a one-time product login transaction
func NewExchangeProductLoginLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ExchangeProductLoginLogic {
	return &ExchangeProductLoginLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ExchangeProductLoginLogic) ExchangeProductLogin(req *types.ProductLoginExchangeReq) (resp *types.ProductLoginExchangeResp, err error) {
	if req == nil || l.svcCtx.Sessions == nil {
		return nil, fmt.Errorf("session service is unavailable")
	}
	claims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found || !hasScope(claims.Scopes, "session.resolve") {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	value, err := l.svcCtx.Sessions.ExchangeProductTransactionFor(l.ctx, req.Code, claims.EnterpriseID, claims.ApplicationInstanceID)
	if err != nil {
		return nil, err
	}
	return &types.ProductLoginExchangeResp{SessionToken: value.Token, CSRFToken: value.CSRFToken, ExpiresAt: value.ExpiresAt.Unix()}, nil
}
