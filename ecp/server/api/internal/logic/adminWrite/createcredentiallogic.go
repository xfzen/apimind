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

type CreateCredentialLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Create a scoped service credential
func NewCreateCredentialLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateCredentialLogic {
	return &CreateCredentialLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateCredentialLogic) CreateCredential(req *types.CreateCredentialReq) (resp *types.CredentialResp, err error) {
	if req == nil || l.svcCtx.Credential == nil {
		return nil, fmt.Errorf("credential service unavailable")
	}
	enterpriseID, scopeErr := requireEnterprise(l.ctx, req.EnterpriseID)
	if scopeErr != nil {
		return nil, scopeErr
	}
	claims, found := apiMiddleware.ClaimsFromContext(l.ctx)
	if !found || claims.PrincipalID == "" {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	var value credentialservice.Created
	err = runAuditedMutation(l.ctx, l.svcCtx.Audit, auditservice.Operation{EnterpriseID: enterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, ActorID: claims.PrincipalID, ActorKind: "principal", Action: "credential.create", ResourceType: "application_instance", ResourceID: req.ApplicationInstanceID, SafeDiff: map[string]any{"scope_count": len(req.Scopes)}}, func() error {
		var createErr error
		value, createErr = l.svcCtx.Credential.Create(l.ctx, credentialservice.CreateInput{EnterpriseID: enterpriseID, ApplicationID: req.ApplicationID, ApplicationInstanceID: req.ApplicationInstanceID, Name: req.Name, Scopes: credentialScopes(req.Scopes), Lifetime: time.Duration(req.LifetimeSeconds) * time.Second})
		return createErr
	})
	if err != nil {
		return nil, err
	}
	return createdCredential(value), nil
}
