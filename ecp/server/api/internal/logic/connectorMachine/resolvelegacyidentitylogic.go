// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	identityservice "github.com/xfzen/ecp/server/internal/service/identity"

	"github.com/zeromicro/go-zero/core/logx"
)

type ResolveLegacyIdentityLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Resolve a mapped legacy product identity
func NewResolveLegacyIdentityLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ResolveLegacyIdentityLogic {
	return &ResolveLegacyIdentityLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ResolveLegacyIdentityLogic) ResolveLegacyIdentity(req *types.ResolveLegacyIdentityReq) (resp *types.ResolveLegacyIdentityResp, err error) {
	if req == nil || l.svcCtx.Identity == nil {
		return nil, fmt.Errorf("identity service unavailable")
	}
	claims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found || !hasScope(claims.Scopes, "identity.legacy.resolve") || claims.EnterpriseID == "" || claims.ApplicationID == "" {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	principal, err := l.svcCtx.Identity.ResolveLegacyIdentity(l.ctx, identityservice.LegacyIdentityInput{EnterpriseID: claims.EnterpriseID, ApplicationID: claims.ApplicationID, Source: req.LegacySource, Subject: req.LegacySubject})
	if err != nil {
		return nil, err
	}
	return &types.ResolveLegacyIdentityResp{PrincipalID: principal.ID}, nil
}
