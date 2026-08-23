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

type ResolveProductSessionLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Resolve a product session
func NewResolveProductSessionLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ResolveProductSessionLogic {
	return &ResolveProductSessionLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ResolveProductSessionLogic) ResolveProductSession(req *types.ResolveProductSessionReq) (resp *types.ResolveProductSessionResp, err error) {
	if req == nil || l.svcCtx.Sessions == nil || l.svcCtx.Identity == nil {
		return nil, fmt.Errorf("session service unavailable")
	}
	claims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found || !hasScope(claims.Scopes, "session.resolve") || claims.ApplicationInstanceID != req.InstanceID {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	value, err := l.svcCtx.Sessions.Resolve(l.ctx, req.SessionToken, sessionservice.ProductSession)
	if err != nil {
		return nil, err
	}
	if value.ApplicationInstanceID != req.InstanceID {
		return nil, fmt.Errorf("session_instance_mismatch")
	}
	identity, err := l.svcCtx.Identity.ResolveProductIdentity(l.ctx, claims.EnterpriseID, claims.ApplicationID, value.PrincipalID, "yapi_user_id")
	if err != nil {
		return nil, err
	}
	return &types.ResolveProductSessionResp{
		PrincipalID: value.PrincipalID, DisplayName: identity.Principal.DisplayName, Email: identity.Principal.NormalizedEmail,
		LegacySubject: identity.LegacySubject, Revoked: value.RevokedAt != nil, ExpiresAt: value.ExpiresAt.Unix(), LifecycleVersion: value.Version,
	}, nil
}
