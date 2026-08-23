// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type ListIdentitySourcesLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List enterprise identity source status
func NewListIdentitySourcesLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListIdentitySourcesLogic {
	return &ListIdentitySourcesLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListIdentitySourcesLogic) ListIdentitySources(req *types.AdminEnterpriseReq) (resp *types.IdentitySourceListResp, err error) {
	if req == nil || l.svcCtx.AdminQuery == nil {
		return nil, fmt.Errorf("admin query service unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	values, err := l.svcCtx.AdminQuery.ListIdentitySources(l.ctx, enterpriseID)
	if err != nil {
		return nil, err
	}
	resp = &types.IdentitySourceListResp{Sources: make([]types.IdentitySourceResp, 0, len(values))}
	for _, value := range values {
		item := types.IdentitySourceResp{ID: value.ID, Provider: value.Provider, Version: value.Version, State: value.State, LastError: value.LastError}
		if value.LastSuccessfulSync != nil {
			item.LastSuccessfulSync = value.LastSuccessfulSync.Unix()
		}
		if value.FreshnessDeadline != nil {
			item.FreshnessDeadline = value.FreshnessDeadline.Unix()
		}
		resp.Sources = append(resp.Sources, item)
	}
	return resp, nil
}
