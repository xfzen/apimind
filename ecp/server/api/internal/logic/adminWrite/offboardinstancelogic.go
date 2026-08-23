// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"encoding/json"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	operationservice "github.com/xfzen/ecp/server/internal/service/operation"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type OffboardInstanceLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Safely offboard one product instance without deleting product data
func NewOffboardInstanceLogic(ctx context.Context, svcCtx *svc.ServiceContext) *OffboardInstanceLogic {
	return &OffboardInstanceLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *OffboardInstanceLogic) OffboardInstance(req *types.InstanceOperationReq) (resp *types.OffboardResp, err error) {
	if req == nil || l.svcCtx.Operations == nil {
		return nil, fmt.Errorf("operation service unavailable")
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	var value operationservice.OffboardResult
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.InstanceID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "instance.offboard", ResourceType: "instance", ResourceID: req.InstanceID, SafeDiff: map[string]any{"retention": "preserved", "target_status": "disabled"}}, func() error {
		var offboardErr error
		value, offboardErr = l.svcCtx.Operations.OffboardInstance(l.ctx, req.EnterpriseID, req.InstanceID)
		return offboardErr
	})
	if err != nil {
		return nil, err
	}
	payload, err := json.Marshal(value.Export)
	if err != nil {
		return nil, err
	}
	return &types.OffboardResp{
		ExportVerified: value.ExportVerified, SessionsRevoked: value.SessionsRevoked, CredentialsRevoked: value.CredentialsRevoked,
		AuditFlushed: value.AuditFlushed, ConnectorDisabled: value.ConnectorDisabled, FinalLifecycleVersion: value.FinalLifecycleVersion,
		Export: types.PortableExportResp{Version: value.Export.Version, GeneratedAt: value.Export.GeneratedAt.Unix(), CanonicalHash: value.Export.CanonicalHash, Payload: string(payload)},
	}, nil
}
