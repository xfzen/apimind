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

type AckDelegationKeySetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Acknowledge the exact accepted Delegation KeySet
func NewAckDelegationKeySetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AckDelegationKeySetLogic {
	return &AckDelegationKeySetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AckDelegationKeySetLogic) AckDelegationKeySet(req *types.AckDelegationKeySetReq) (resp *types.Empty, err error) {
	if req == nil || l.svcCtx.Connector == nil {
		return nil, fmt.Errorf("connector service unavailable")
	}
	contextClaims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found {
		return nil, fmt.Errorf("connector claims unavailable")
	}
	claims, err := connectorClaims(contextClaims, "keyset.ack")
	if err != nil {
		return nil, err
	}
	if err := l.svcCtx.Connector.AckDelegationKeySet(l.ctx, claims, req.Version, req.AcceptedKeyIDs); err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}
