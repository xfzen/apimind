// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"

	"github.com/zeromicro/go-zero/core/logx"
)

type RevokeCredentialLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Revoke a service credential
func NewRevokeCredentialLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RevokeCredentialLogic {
	return &RevokeCredentialLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RevokeCredentialLogic) RevokeCredential(req *types.CredentialIDReq) (resp *types.Empty, err error) {
	if req == nil || l.svcCtx.Credential == nil {
		return nil, fmt.Errorf("credential service unavailable")
	}
	enterpriseID, scopeErr := sessionEnterprise(l.ctx)
	if scopeErr != nil {
		return nil, scopeErr
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.PrincipalID == "" {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	metadata, err := l.svcCtx.Credential.DescribeForEnterprise(l.ctx, enterpriseID, req.ID)
	if err != nil {
		return nil, err
	}
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: enterpriseID, ApplicationInstanceID: metadata.ApplicationInstanceID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "credential.revoke", ResourceType: "service_credential", ResourceID: metadata.ID, SafeDiff: map[string]any{"previous_status": metadata.Status, "new_status": "revoked"}}, func() error {
		return l.svcCtx.Credential.RevokeForEnterprise(l.ctx, enterpriseID, req.ID)
	})
	if err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}
