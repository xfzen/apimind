// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"
	"time"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	credentialservice "github.com/xfzen/ecp/server/internal/service/credential"

	"github.com/zeromicro/go-zero/core/logx"
)

type RotateCredentialLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Rotate a service credential
func NewRotateCredentialLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RotateCredentialLogic {
	return &RotateCredentialLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RotateCredentialLogic) RotateCredential(req *types.RotateCredentialReq) (resp *types.CredentialResp, err error) {
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
	var value credentialservice.Created
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: enterpriseID, ApplicationInstanceID: metadata.ApplicationInstanceID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "credential.rotate", ResourceType: "service_credential", ResourceID: metadata.ID, SafeDiff: map[string]any{"previous_status": metadata.Status, "new_status": "rotating"}}, func() error {
		var rotateErr error
		value, rotateErr = l.svcCtx.Credential.RotateForEnterprise(l.ctx, enterpriseID, req.ID, time.Duration(req.LifetimeSeconds)*time.Second)
		return rotateErr
	})
	if err != nil {
		return nil, err
	}
	return createdCredential(value), nil
}
