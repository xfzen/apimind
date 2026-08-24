// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"
	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/internal/domain"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type BatchAuthorizeLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Authorize a batch of product operations
func NewBatchAuthorizeLogic(ctx context.Context, svcCtx *svc.ServiceContext) *BatchAuthorizeLogic {
	return &BatchAuthorizeLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *BatchAuthorizeLogic) BatchAuthorize(req *types.BatchAuthorizeReq) (resp *types.BatchAuthorizeResp, err error) {
	if req == nil || l.svcCtx.Access == nil {
		return nil, fmt.Errorf("access service is unavailable")
	}
	claims, ok := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !ok || !hasScope(claims.Scopes, "access.authorize") {
		l.Errorf("batch authorization rejected: connector scope mismatch")
		return nil, fmt.Errorf("connector_scope_mismatch")
	}
	requests := make([]domain.AuthorizationRequest, 0, len(req.Requests))
	for _, value := range req.Requests {
		if value.EnterpriseID != claims.EnterpriseID || value.ApplicationInstanceID != claims.ApplicationInstanceID {
			l.Errorf("batch authorization rejected: connector boundary mismatch")
			return nil, fmt.Errorf("connector_scope_mismatch")
		}
		requests = append(requests, authorizationRequest(value))
	}
	decisions, err := l.svcCtx.Access.BatchAuthorize(l.ctx, requests)
	if err != nil {
		l.Errorf("batch authorization failed: %v", err)
		return nil, err
	}
	resp = &types.BatchAuthorizeResp{Decisions: make([]types.AuthorizationDecisionResp, 0, len(decisions))}
	for _, decision := range decisions {
		resp.Decisions = append(resp.Decisions, decisionResponse(decision))
	}
	return resp, nil
}
