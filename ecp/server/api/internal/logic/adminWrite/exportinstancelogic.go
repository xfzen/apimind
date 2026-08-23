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

type ExportInstanceLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Create a portable instance metadata export
func NewExportInstanceLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ExportInstanceLogic {
	return &ExportInstanceLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ExportInstanceLogic) ExportInstance(req *types.InstanceOperationReq) (resp *types.PortableExportResp, err error) {
	if req == nil || l.svcCtx.Operations == nil {
		return nil, fmt.Errorf("operation service unavailable")
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	var value operationservice.PortableExport
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.InstanceID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "instance.export", ResourceType: "instance", ResourceID: req.InstanceID, SafeDiff: map[string]any{"format_version": 1}}, func() error {
		var exportErr error
		value, exportErr = l.svcCtx.Operations.ExportInstance(l.ctx, req.EnterpriseID, req.InstanceID)
		return exportErr
	})
	if err != nil {
		return nil, err
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	return &types.PortableExportResp{Version: value.Version, GeneratedAt: value.GeneratedAt.Unix(), CanonicalHash: value.CanonicalHash, Payload: string(payload)}, nil
}
