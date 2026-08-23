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

type GetDelegationKeySetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get the signed Delegation verification KeySet
func NewGetDelegationKeySetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetDelegationKeySetLogic {
	return &GetDelegationKeySetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetDelegationKeySetLogic) GetDelegationKeySet() (resp *types.DelegationKeySetResp, err error) {
	if l.svcCtx.Connector == nil {
		return nil, fmt.Errorf("connector service unavailable")
	}
	contextClaims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found {
		return nil, fmt.Errorf("connector claims unavailable")
	}
	claims, err := connectorClaims(contextClaims, "keyset.read")
	if err != nil {
		return nil, err
	}
	value, root, err := l.svcCtx.Connector.GetDelegationKeySet(l.ctx, claims)
	if err != nil {
		return nil, err
	}
	return keySetResponse(value, root), nil
}
