// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"

	"github.com/zeromicro/go-zero/core/logx"
)

type QueryAuditLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Query append-only audit events
func NewQueryAuditLogic(ctx context.Context, svcCtx *svc.ServiceContext) *QueryAuditLogic {
	return &QueryAuditLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *QueryAuditLogic) QueryAudit(req *types.AuditQueryReq) (resp *types.AuditQueryResp, err error) {
	if req == nil || l.svcCtx.Audit == nil {
		return nil, fmt.Errorf("audit service unavailable")
	}
	values, err := l.svcCtx.Audit.Query(l.ctx, auditservice.Query{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, OperationID: req.OperationID, SequenceAfter: req.SequenceAfter, Limit: req.Limit})
	if err != nil {
		return nil, err
	}
	events := make([]types.AuditEventResp, 0, len(values))
	for _, value := range values {
		events = append(events, types.AuditEventResp{Sequence: value.Sequence, ID: value.ID, EnterpriseID: value.EnterpriseID, ApplicationInstanceID: value.ApplicationInstanceID, OperationID: value.OperationID, Stage: value.Stage, ActorID: value.ActorID, ActorKind: value.ActorKind, Action: value.Action, ResourceType: value.ResourceType, ResourceID: value.ResourceID, Outcome: value.Outcome, Reason: value.Reason, SafeDiff: string(value.SafeDiff), OccurredAt: value.OccurredAt.Unix()})
	}
	return &types.AuditQueryResp{Events: events}, nil
}
