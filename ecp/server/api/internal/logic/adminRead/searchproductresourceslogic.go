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

type SearchProductResourcesLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Search resources visible to the current enterprise administrator
func NewSearchProductResourcesLogic(ctx context.Context, svcCtx *svc.ServiceContext) *SearchProductResourcesLogic {
	return &SearchProductResourcesLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *SearchProductResourcesLogic) SearchProductResources(req *types.ProductResourceSearchReq) (resp *types.ProductResourceListResp, err error) {
	if req == nil || l.svcCtx.ProductResources == nil {
		return nil, fmt.Errorf("product resource service unavailable")
	}
	actor, err := productResourceActor(l.ctx)
	if err != nil {
		return nil, err
	}
	resourceType := req.ResourceType
	if resourceType == "" {
		resourceType = "project"
	}
	action, err := productResourceAction(resourceType)
	if err != nil {
		return nil, err
	}
	values, err := l.svcCtx.ProductResources.Search(l.ctx, actor, productresourceservice.SearchInput{InstanceID: req.InstanceID, ResourceType: resourceType, Query: req.Query, RequestedAction: action, Limit: req.Limit})
	if err != nil {
		return nil, err
	}
	resp = &types.ProductResourceListResp{Resources: make([]types.ProductResourceItem, len(values))}
	for index := range values {
		resp.Resources[index] = mapProductResource(values[index])
	}
	return resp, nil
}
