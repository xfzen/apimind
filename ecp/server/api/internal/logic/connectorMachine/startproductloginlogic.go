// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
	sessionservice "github.com/xfzen/ecp/server/internal/service/session"

	"github.com/zeromicro/go-zero/core/logx"
)

type StartProductLoginLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Begin a product OIDC login transaction
func NewStartProductLoginLogic(ctx context.Context, svcCtx *svc.ServiceContext) *StartProductLoginLogic {
	return &StartProductLoginLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *StartProductLoginLogic) StartProductLogin(req *types.ProductAuthStartReq) (resp *types.ProductAuthStartResp, err error) {
	if req == nil || l.svcCtx.OIDCClients == nil || l.svcCtx.Sessions == nil {
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
	if err := l.svcCtx.OIDCClients.ValidateRedirect(client.RedirectURIs, req.RedirectURI); err != nil {
		return nil, err
	}
	transaction, err := l.svcCtx.Sessions.Begin(l.ctx, sessionservice.BeginInput{
		EnterpriseID: claims.EnterpriseID, OIDCClientID: client.ID, ApplicationInstanceID: claims.ApplicationInstanceID,
		Kind: sessionservice.ProductSession, RedirectURI: req.RedirectURI,
	})
	if err != nil {
		return nil, err
	}
	authorizationURL, err := casdoor.BuildAuthorizationURL(casdoor.AuthorizationRequest{
		Endpoint: l.svcCtx.Config.OIDC.AuthorizationEndpoint, ClientID: client.ClientID, RedirectURI: req.RedirectURI,
		State: transaction.State, Nonce: transaction.Nonce, CodeChallenge: sessionservice.PKCEChallenge(transaction.PKCEVerifier), LocalMode: l.svcCtx.Config.OIDC.LocalMode,
	})
	if err != nil {
		return nil, err
	}
	return &types.ProductAuthStartResp{
		TransactionID: transaction.TransactionID, State: transaction.State, PKCEVerifier: transaction.PKCEVerifier,
		Nonce: transaction.Nonce, AuthorizationURL: authorizationURL, ExpiresAt: transaction.ExpiresAt.Unix(),
	}, nil
}
