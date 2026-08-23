// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package operatorMachine

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	connectorservice "github.com/xfzen/ecp/server/internal/service/connector"

	"github.com/zeromicro/go-zero/core/logx"
)

type PublishDelegationKeySetLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Publish an offline-root-signed Delegation KeySet
func NewPublishDelegationKeySetLogic(ctx context.Context, svcCtx *svc.ServiceContext) *PublishDelegationKeySetLogic {
	return &PublishDelegationKeySetLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *PublishDelegationKeySetLogic) PublishDelegationKeySet(req *types.PublishDelegationKeySetReq) (resp *types.DelegationKeySetResp, err error) {
	if req == nil || l.svcCtx.Connector == nil {
		return nil, fmt.Errorf("connector service unavailable")
	}
	contextClaims, found := apiMiddleware.OperatorClaimsFromContext(l.ctx)
	if !found {
		return nil, fmt.Errorf("operator claims unavailable")
	}
	if len(req.Payload) == 0 {
		return nil, fmt.Errorf("keyset payload invalid")
	}
	value, err := l.svcCtx.Connector.PublishDelegationKeySet(l.ctx, connectorservice.Claims{ConnectorID: contextClaims.CredentialID, Channel: domain.TrustChannelKeySetOperator, Scopes: contextClaims.Scopes}, connectorservice.SignedKeySetEnvelope{Algorithm: req.Algorithm, SigningKeyID: req.SigningKeyID, Payload: req.Payload, Signature: req.Signature})
	if err != nil {
		return nil, err
	}
	return &types.DelegationKeySetResp{Algorithm: value.Algorithm, SigningKeyID: value.SigningKeyID, Payload: append([]byte(nil), value.SignedPayload...), Signature: value.RootSignature}, nil
}
