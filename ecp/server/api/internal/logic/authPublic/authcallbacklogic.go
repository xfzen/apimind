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

type AuthCallbackLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Complete an OIDC login transaction
func NewAuthCallbackLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AuthCallbackLogic {
	return &AuthCallbackLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AuthCallbackLogic) AuthCallback(req *types.AuthCallbackReq) (resp *types.SessionSummaryResp, err error) {
	return nil, fmt.Errorf("oidc_transaction_cookie_required")
}

func (l *AuthCallbackLogic) Complete(req *types.AuthCallbackReq, transactionID, verifier, nonce string) (*types.SessionSummaryResp, string, string, error) {
	if req == nil || l.svcCtx.Sessions == nil {
		return nil, "", "", fmt.Errorf("session service is unavailable")
	}
	value, err := l.svcCtx.Sessions.Complete(l.ctx, sessionservice.CompleteInput{TransactionID: transactionID, State: req.State, PKCEVerifier: verifier, Nonce: nonce, Code: req.Code, ExpectedAudience: l.svcCtx.Config.OIDC.AdminAudience})
	if err != nil {
		return nil, "", "", err
	}
	resp := &types.SessionSummaryResp{ID: value.ID, EnterpriseID: value.EnterpriseID, PrincipalID: value.PrincipalID, ApplicationInstanceID: value.ApplicationInstanceID, Kind: value.Kind, ExpiresAt: value.ExpiresAt.Unix(), Revoked: value.RevokedAt != nil}
	return resp, value.Token, value.CSRFToken, nil
}
