// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"
	"time"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"

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
	if l.svcCtx.Audit == nil {
		return nil, fmt.Errorf("audit service unavailable")
	}
	claims, found := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !found || !hasScope(claims.Scopes, "audit.ingest") {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	events := make([]auditservice.ProductEvent, 0, len(req.Events))
	for _, event := range req.Events {
		events = append(events, auditservice.ProductEvent{OperationID: event.OperationID, ActorID: claims.ConnectorID, ActorKind: "service", Action: event.Action, ResourceType: event.ResourceType, ResourceID: event.ResourceID, Outcome: event.Outcome, OccurredAt: time.Unix(event.OccurredAt, 0).UTC()})
	}
	if err := l.svcCtx.Audit.Ingest(l.ctx, auditservice.IngestRequest{EnterpriseID: claims.EnterpriseID, ApplicationInstanceID: claims.ApplicationInstanceID, AuthenticatedInstanceID: claims.ApplicationInstanceID, Events: events}); err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}
