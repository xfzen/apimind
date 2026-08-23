// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
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
	value, err := l.svcCtx.Credential.Create(l.ctx, credentialservice.CreateInput{EnterpriseID: req.EnterpriseID, ApplicationID: req.ApplicationID, ApplicationInstanceID: req.ApplicationInstanceID, Name: req.Name, Scopes: credentialScopes(req.Scopes), Lifetime: time.Duration(req.LifetimeSeconds) * time.Second})
	if err != nil {
		return nil, err
	}
	return createdCredential(value), nil
}
