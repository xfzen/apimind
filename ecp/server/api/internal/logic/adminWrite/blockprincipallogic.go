// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"

	"github.com/zeromicro/go-zero/core/logx"
)

type BlockPrincipalLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Block a principal locally
func NewBlockPrincipalLogic(ctx context.Context, svcCtx *svc.ServiceContext) *BlockPrincipalLogic {
	return &BlockPrincipalLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *BlockPrincipalLogic) BlockPrincipal(req *types.BlockPrincipalReq) (resp *types.LifecycleResp, err error) {
	if req == nil || l.svcCtx.Lifecycle == nil {
		return nil, fmt.Errorf("lifecycle service is unavailable")
	}
	enterpriseID, scopeErr := requireEnterprise(l.ctx, req.EnterpriseID)
	if scopeErr != nil {
		return nil, scopeErr
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.PrincipalID == "" {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	var value domain.PrincipalLifecycle
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: enterpriseID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "principal.block", ResourceType: "principal", ResourceID: req.PrincipalID, SafeDiff: map[string]any{"new_status": domain.LifecycleBlocked}}, func() error {
		var blockErr error
		value, blockErr = l.svcCtx.Lifecycle.Block(l.ctx, enterpriseID, req.PrincipalID)
		return blockErr
	})
	if err != nil {
		return nil, err
	}
	return &types.LifecycleResp{PrincipalID: value.PrincipalID, State: value.State, Version: value.Version}, nil
}
