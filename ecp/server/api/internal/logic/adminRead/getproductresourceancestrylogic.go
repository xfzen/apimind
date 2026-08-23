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

type GetProductResourceAncestryLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get the visible authorization ancestry for one product resource
func NewGetProductResourceAncestryLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetProductResourceAncestryLogic {
	return &GetProductResourceAncestryLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetProductResourceAncestryLogic) GetProductResourceAncestry(req *types.ProductResourceReq) (resp *types.ProductResourceListResp, err error) {
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
	values, err := l.svcCtx.ProductResources.Ancestry(l.ctx, actor, productresourceservice.ResourceInput{InstanceID: req.InstanceID, ResourceType: req.ResourceType, ResourceID: req.ResourceID, RequestedAction: action})
	if err != nil {
		return nil, err
	}
	resp = &types.ProductResourceListResp{Resources: make([]types.ProductResourceItem, len(values))}
	for index := range values {
		resp.Resources[index] = mapProductResource(values[index])
	}
	return resp, nil
}
