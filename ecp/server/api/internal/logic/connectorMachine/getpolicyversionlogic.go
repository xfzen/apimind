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

type GetPolicyVersionLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get the current policy projection version
func NewGetPolicyVersionLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetPolicyVersionLogic {
	return &GetPolicyVersionLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetPolicyVersionLogic) GetPolicyVersion(req *types.PolicyVersionReq) (resp *types.PolicyVersionResp, err error) {
	if req == nil || l.svcCtx.Connector == nil {
		return nil, fmt.Errorf("connector service unavailable")
	}
	contextClaims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found || contextClaims.ApplicationInstanceID != req.InstanceID {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	claims, err := connectorClaims(contextClaims, "policy.read")
	if err != nil {
		return nil, err
	}
	value, err := l.svcCtx.Connector.GetPolicyVersion(l.ctx, claims)
	if err != nil {
		return nil, err
	}
	return &types.PolicyVersionResp{Version: value.PolicyVersion, State: value.ReconciliationState, CanonicalHash: value.NormalizedHash}, nil
}
