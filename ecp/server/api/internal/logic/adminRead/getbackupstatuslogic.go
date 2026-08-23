// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetBackupStatusLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get the latest coordinated backup verification status
func NewGetBackupStatusLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetBackupStatusLogic {
	return &GetBackupStatusLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetBackupStatusLogic) GetBackupStatus(req *types.BackupStatusReq) (resp *types.BackupStatusResp, err error) {
	if req == nil || l.svcCtx.Operations == nil {
		return nil, fmt.Errorf("operation service unavailable")
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	value, err := l.svcCtx.Operations.BackupStatus(l.ctx, req.EnterpriseID)
	if err != nil {
		return nil, err
	}
	resp = &types.BackupStatusResp{State: value.State, BackupID: value.BackupID, ManifestHash: value.ManifestHash, FailureReason: value.FailureReason}
	if !value.StartedAt.IsZero() {
		resp.StartedAt = value.StartedAt.Unix()
	}
	if value.CompletedAt != nil {
		resp.CompletedAt = value.CompletedAt.Unix()
	}
	if value.VerifiedAt != nil {
		resp.VerifiedAt = value.VerifiedAt.Unix()
	}
	return resp, nil
}
