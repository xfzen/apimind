// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type IngestConnectorAuditLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Ingest product audit events
func NewIngestConnectorAuditLogic(ctx context.Context, svcCtx *svc.ServiceContext) *IngestConnectorAuditLogic {
	return &IngestConnectorAuditLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *IngestConnectorAuditLogic) IngestConnectorAudit(req *types.IngestConnectorAuditReq) (resp *types.Empty, err error) {
	if req == nil {
		return nil, fmt.Errorf("audit events required")
	}
	return nil, fmt.Errorf("audit_ingest_unavailable")
}
