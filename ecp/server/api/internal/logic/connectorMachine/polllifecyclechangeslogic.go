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

type PollLifecycleChangesLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Poll principal lifecycle changes
func NewPollLifecycleChangesLogic(ctx context.Context, svcCtx *svc.ServiceContext) *PollLifecycleChangesLogic {
	return &PollLifecycleChangesLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *PollLifecycleChangesLogic) PollLifecycleChanges(req *types.LifecyclePollReq) (resp *types.LifecyclePollResp, err error) {
	if req == nil || l.svcCtx.Connector == nil {
		return nil, fmt.Errorf("connector service unavailable")
	}
	contextClaims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found {
		return nil, fmt.Errorf("connector claims unavailable")
	}
	claims, err := connectorClaims(contextClaims, "lifecycle.read")
	if err != nil {
		return nil, err
	}
	values, next, err := l.svcCtx.Connector.PollLifecycleChanges(l.ctx, claims, req.Cursor, req.Limit)
	if err != nil {
		return nil, err
	}
	items := make([]types.LifecycleChangeItem, 0, len(values))
	for _, value := range values {
		items = append(items, types.LifecycleChangeItem{PrincipalID: value.PrincipalID, State: value.State, Version: value.Version})
	}
	return &types.LifecyclePollResp{Changes: items, NextCursor: next}, nil
}
