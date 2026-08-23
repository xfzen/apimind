// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package metaPublic

import (
	"context"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type VersionLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Build and contract version
func NewVersionLogic(ctx context.Context, svcCtx *svc.ServiceContext) *VersionLogic {
	return &VersionLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *VersionLogic) Version() (resp *types.VersionResp, err error) {
	return &types.VersionResp{Version: l.svcCtx.Config.Build.Version, APIVersion: "v1"}, nil
}
