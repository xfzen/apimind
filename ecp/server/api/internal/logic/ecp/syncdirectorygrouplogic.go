// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package ecp

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	identityservice "github.com/xfzen/ecp/server/internal/service/identity"

	"github.com/zeromicro/go-zero/core/logx"
)

type SyncDirectoryGroupLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Synchronize a directory-managed direct group
func NewSyncDirectoryGroupLogic(ctx context.Context, svcCtx *svc.ServiceContext) *SyncDirectoryGroupLogic {
	return &SyncDirectoryGroupLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *SyncDirectoryGroupLogic) SyncDirectoryGroup(req *types.SyncDirectoryGroupReq) (resp *types.GroupResp, err error) {
	if req == nil || l.svcCtx.Identity == nil {
		return nil, fmt.Errorf("identity service is unavailable")
	}
	value, err := l.svcCtx.Identity.SyncDirectoryGroup(l.ctx, identityservice.DirectoryGroupInput{EnterpriseID: req.EnterpriseID, Provider: req.Provider, ExternalID: req.ExternalID, Name: req.Name}, req.PrincipalIDs)
	if err != nil {
		return nil, err
	}
	return groupResponse(value), nil
}
