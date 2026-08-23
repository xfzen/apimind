// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"

	"github.com/zeromicro/go-zero/core/logx"
)

type ExportAuditLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Create a verifiable audit export manifest
func NewExportAuditLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ExportAuditLogic {
	return &ExportAuditLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ExportAuditLogic) ExportAudit(req *types.AuditExportReq) (resp *types.AuditExportResp, err error) {
	if req == nil || l.svcCtx.Audit == nil {
		return nil, fmt.Errorf("audit service unavailable")
	}
	enterpriseID, scopeErr := requireEnterprise(l.ctx, req.EnterpriseID)
	if scopeErr != nil {
		return nil, scopeErr
	}
	value, err := l.svcCtx.Audit.ExportManifest(l.ctx, auditservice.Query{EnterpriseID: enterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, SequenceAfter: req.SequenceAfter, Limit: req.Limit})
	if err != nil {
		return nil, err
	}
	return &types.AuditExportResp{Version: value.Version, SequenceStart: value.SequenceStart, SequenceEnd: value.SequenceEnd, EventCount: value.EventCount, CanonicalHash: value.CanonicalHash, GeneratedAt: value.GeneratedAt.Unix()}, nil
}
