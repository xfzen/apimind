// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	productresourceservice "github.com/xfzen/ecp/server/internal/service/productresource"

	"github.com/zeromicro/go-zero/core/logx"
)

type ResolveProductResourceLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Resolve one product resource visible to the current enterprise administrator
func NewResolveProductResourceLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ResolveProductResourceLogic {
	return &ResolveProductResourceLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ResolveProductResourceLogic) ResolveProductResource(req *types.ProductResourceReq) (resp *types.ProductResourceResp, err error) {
	if req == nil || l.svcCtx.ProductResources == nil {
		return nil, fmt.Errorf("product resource service unavailable")
	}
	actor, err := productResourceActor(l.ctx)
	if err != nil {
		return nil, err
	}
	action, err := productResourceAction(req.ResourceType)
	if err != nil {
		return nil, err
	}
	value, err := l.svcCtx.ProductResources.Resolve(l.ctx, actor, productresourceservice.ResourceInput{InstanceID: req.InstanceID, ResourceType: req.ResourceType, ResourceID: req.ResourceID, RequestedAction: action})
	if err != nil {
		return nil, err
	}
	return &types.ProductResourceResp{Resource: mapProductResource(value)}, nil
}
