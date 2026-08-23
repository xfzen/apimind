// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"

	"github.com/zeromicro/go-zero/core/logx"
)

type PutManifestLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Put a product manifest
func NewPutManifestLogic(ctx context.Context, svcCtx *svc.ServiceContext) *PutManifestLogic {
	return &PutManifestLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *PutManifestLogic) PutManifest(req *types.PutManifestReq) (resp *types.ManifestResp, err error) {
	if req == nil || l.svcCtx.Registry == nil {
		return nil, fmt.Errorf("registry is unavailable")
	}
	value, err := l.svcCtx.Registry.PutManifest(l.ctx, registryservice.PutManifestInput{
		EnterpriseID: req.EnterpriseID, ApplicationID: req.ApplicationID, APIVersion: req.APIVersion, Body: []byte(req.Body),
	})
	if err != nil {
		return nil, err
	}
	return &types.ManifestResp{ApplicationID: value.ApplicationID, APIVersion: value.APIVersion, ManifestHash: value.ManifestHash, Version: value.Version}, nil
}
