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

type GetManifestLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get the accepted product manifest
func NewGetManifestLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetManifestLogic {
	return &GetManifestLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetManifestLogic) GetManifest(req *types.AdminEntityReq) (resp *types.ManifestDetailResp, err error) {
	if req == nil || l.svcCtx.AdminQuery == nil {
		return nil, fmt.Errorf("admin query service unavailable")
	}
	enterpriseID, err := requireEnterprise(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	value, err := l.svcCtx.AdminQuery.GetManifest(l.ctx, enterpriseID, req.ID)
	if err != nil {
		return nil, err
	}
	return &types.ManifestDetailResp{ApplicationID: value.ApplicationID, APIVersion: value.APIVersion, ManifestHash: value.ManifestHash, Body: string(value.Body), Version: value.Version}, nil
}
