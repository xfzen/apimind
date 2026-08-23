// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package authPublic

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
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
	if req.Kind != sessionservice.AdminSession || req.ApplicationInstanceID != "" {
		return nil, sessionservice.BeginResult{}, fmt.Errorf("login_transaction_invalid")
	}
	client, err := l.svcCtx.OIDCClients.Get(l.ctx, req.EnterpriseID, req.OIDCClientID)
	if err != nil {
		return nil, sessionservice.BeginResult{}, err
	}
	if client.Status != "active" || client.ClientID != l.svcCtx.Config.OIDC.AdminAudience || client.SecretReference != l.svcCtx.Config.OIDC.SecretReference {
		return nil, sessionservice.BeginResult{}, fmt.Errorf("oidc_client_scope_mismatch")
	}
	if err := l.svcCtx.OIDCClients.ValidateRedirect(client.RedirectURIs, req.RedirectURI); err != nil {
		return nil, sessionservice.BeginResult{}, err
	}
	result, err := l.svcCtx.Sessions.Begin(l.ctx, sessionservice.BeginInput{EnterpriseID: req.EnterpriseID, OIDCClientID: req.OIDCClientID, Kind: req.Kind, RedirectURI: req.RedirectURI})
	if err != nil {
		return nil, sessionservice.BeginResult{}, err
	}
	resp := &types.AuthStartResp{TransactionID: result.TransactionID, State: result.State, Nonce: result.Nonce, CodeChallenge: sessionservice.PKCEChallenge(result.PKCEVerifier), ExpiresAt: result.ExpiresAt.Unix()}
	return resp, result, nil
}
