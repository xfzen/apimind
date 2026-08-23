// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	sessionservice "github.com/xfzen/ecp/server/internal/service/session"

	"github.com/zeromicro/go-zero/core/logx"
)

type CompleteProductLoginLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Complete a product OIDC login and issue a one-time exchange
func NewCompleteProductLoginLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CompleteProductLoginLogic {
	return &CompleteProductLoginLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CompleteProductLoginLogic) CompleteProductLogin(req *types.ProductAuthCompleteReq) (resp *types.ProductAuthCompleteResp, err error) {
	if req == nil || l.svcCtx.OIDCClients == nil || l.svcCtx.Sessions == nil || l.svcCtx.NewOIDCVerifier == nil {
		return nil, fmt.Errorf("product login is unavailable")
	}
	claims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found || !hasScope(claims.Scopes, "session.resolve") {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	client, err := l.svcCtx.OIDCClients.GetByInstance(l.ctx, claims.EnterpriseID, claims.ApplicationInstanceID)
	if err != nil {
		return nil, err
	}
	if client.ApplicationID != claims.ApplicationID || client.Status != "active" {
		return nil, fmt.Errorf("oidc_client_scope_mismatch")
	}
	verifier, err := l.svcCtx.NewOIDCVerifier(client)
	if err != nil {
		return nil, err
	}
	value, err := l.svcCtx.Sessions.CompleteProduct(l.ctx, sessionservice.CompleteInput{
		TransactionID: req.TransactionID, State: req.State, PKCEVerifier: req.PKCEVerifier, Nonce: req.Nonce, Code: req.Code,
		ExpectedAudience: client.ClientID, ExpectedEnterpriseID: claims.EnterpriseID,
		ExpectedApplicationInstanceID: claims.ApplicationInstanceID, ExpectedOIDCClientID: client.ID, Verifier: verifier,
	})
	if err != nil {
		return nil, err
	}
	return &types.ProductAuthCompleteResp{ExchangeCode: value.Code, ExpiresAt: value.ExpiresAt.Unix()}, nil
}
