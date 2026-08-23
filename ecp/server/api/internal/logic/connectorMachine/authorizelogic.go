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

type AuthorizeLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Authorize one product operation
func NewAuthorizeLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AuthorizeLogic {
	return &AuthorizeLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AuthorizeLogic) Authorize(req *types.AuthorizeReq) (resp *types.AuthorizationDecisionResp, err error) {
	if req == nil || l.svcCtx.Access == nil {
		return nil, fmt.Errorf("access service is unavailable")
	}
	claims, ok := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !ok || claims.EnterpriseID != req.EnterpriseID || claims.ApplicationInstanceID != req.ApplicationInstanceID {
		return nil, fmt.Errorf("connector_scope_mismatch")
	}
	decision, err := l.svcCtx.Access.Authorize(l.ctx, authorizationRequest(*req))
	if err != nil {
		return nil, err
	}
	value := decisionResponse(decision)
	return &value, nil
}
