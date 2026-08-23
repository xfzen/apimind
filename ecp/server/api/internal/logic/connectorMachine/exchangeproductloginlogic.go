// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"

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
	value, err := l.svcCtx.Sessions.ExchangeProductTransaction(l.ctx, req.Code)
	if err != nil {
		return nil, err
	}
	return &types.ProductLoginExchangeResp{SessionToken: value.Token, CSRFToken: value.CSRFToken, ExpiresAt: value.ExpiresAt.Unix()}, nil
}
