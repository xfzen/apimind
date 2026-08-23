// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

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
	value, err := l.svcCtx.Lifecycle.Block(l.ctx, enterpriseID, req.PrincipalID)
	if err != nil {
		return nil, err
	}
	return &types.LifecycleResp{PrincipalID: value.PrincipalID, State: value.State, Version: value.Version}, nil
}
