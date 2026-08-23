// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

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
	if err := l.svcCtx.Credential.Revoke(l.ctx, req.ID); err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}
