// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

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
	value, err := l.svcCtx.Credential.RotateForEnterprise(l.ctx, enterpriseID, req.ID, time.Duration(req.LifetimeSeconds)*time.Second)
	if err != nil {
		return nil, err
	}
	return createdCredential(value), nil
}
