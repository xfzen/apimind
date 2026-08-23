// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package authPublic

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
	sessionservice "github.com/xfzen/ecp/server/internal/service/session"

	"github.com/zeromicro/go-zero/core/logx"
)

type AuthStartLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Begin an OIDC login transaction
func NewAuthStartLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AuthStartLogic {
	return &AuthStartLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AuthStartLogic) AuthStart(req *types.AuthStartReq) (resp *types.AuthStartResp, err error) {
	resp, _, err = l.Begin(req)
	return resp, err
}

func (l *AuthStartLogic) Begin(req *types.AuthStartReq) (*types.AuthStartResp, sessionservice.BeginResult, error) {
	if req == nil || l.svcCtx.Sessions == nil || l.svcCtx.OIDCClients == nil {
		return nil, sessionservice.BeginResult{}, fmt.Errorf("session service is unavailable")
	}
	config := l.svcCtx.Config.OIDC
	if config.AdminEnterpriseID == "" || config.AdminClientRecordID == "" || config.AdminRedirectURI == "" {
		return nil, sessionservice.BeginResult{}, fmt.Errorf("admin_login_configuration_incomplete")
	}
	client, err := l.svcCtx.OIDCClients.Get(l.ctx, config.AdminEnterpriseID, config.AdminClientRecordID)
	if err != nil {
		return nil, sessionservice.BeginResult{}, err
	}
	if client.Status != "active" || client.ClientID != config.AdminAudience || client.SecretReference != config.SecretReference {
		return nil, sessionservice.BeginResult{}, fmt.Errorf("oidc_client_scope_mismatch")
	}
	if err := l.svcCtx.OIDCClients.ValidateRedirect(client.RedirectURIs, config.AdminRedirectURI); err != nil {
		return nil, sessionservice.BeginResult{}, err
	}
	result, err := l.svcCtx.Sessions.Begin(l.ctx, sessionservice.BeginInput{EnterpriseID: config.AdminEnterpriseID, OIDCClientID: config.AdminClientRecordID, Kind: sessionservice.AdminSession, RedirectURI: config.AdminRedirectURI})
	if err != nil {
		return nil, sessionservice.BeginResult{}, err
	}
	authorizationURL, err := casdoor.BuildAuthorizationURL(casdoor.AuthorizationRequest{
		Endpoint: config.AuthorizationEndpoint, ClientID: client.ClientID, RedirectURI: config.AdminRedirectURI,
		State: result.State, Nonce: result.Nonce, CodeChallenge: sessionservice.PKCEChallenge(result.PKCEVerifier), LocalMode: config.LocalMode,
	})
	if err != nil {
		return nil, sessionservice.BeginResult{}, err
	}
	resp := &types.AuthStartResp{TransactionID: result.TransactionID, State: result.State, Nonce: result.Nonce, CodeChallenge: sessionservice.PKCEChallenge(result.PKCEVerifier), AuthorizationURL: authorizationURL, ExpiresAt: result.ExpiresAt.Unix()}
	return resp, result, nil
}
