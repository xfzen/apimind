// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	identityservice "github.com/xfzen/ecp/server/internal/service/identity"

	"github.com/zeromicro/go-zero/core/logx"
)

type PutLegacyIdentityLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Create an immutable legacy product identity mapping
func NewPutLegacyIdentityLogic(ctx context.Context, svcCtx *svc.ServiceContext) *PutLegacyIdentityLogic {
	return &PutLegacyIdentityLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *PutLegacyIdentityLogic) PutLegacyIdentity(req *types.PutLegacyIdentityReq) (resp *types.LegacyIdentityResp, err error) {
	if req == nil || l.svcCtx.Identity == nil {
		return nil, fmt.Errorf("identity service unavailable")
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.EnterpriseID != req.EnterpriseID || claims.PrincipalID == "" {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	var value domain.LegacyIdentityMapping
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: req.EnterpriseID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "legacy_identity.map", ResourceType: "application", ResourceID: req.ApplicationID, SafeDiff: map[string]any{"status": "active"}}, func() error {
		var putErr error
		value, putErr = l.svcCtx.Identity.PutLegacyIdentity(l.ctx, identityservice.PutLegacyIdentityInput{EnterpriseID: req.EnterpriseID, ApplicationID: req.ApplicationID, Source: req.LegacySource, Subject: req.LegacySubject, PrincipalID: req.PrincipalID})
		return putErr
	})
	if err != nil {
		return nil, err
	}
	return &types.LegacyIdentityResp{ID: value.ID, ApplicationID: value.ApplicationID, LegacySource: value.LegacySource, LegacySubject: value.LegacySubject, PrincipalID: value.PrincipalID}, nil
}
