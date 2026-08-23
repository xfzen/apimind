// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	identityservice "github.com/xfzen/ecp/server/internal/service/identity"

	"github.com/zeromicro/go-zero/core/logx"
)

type AdmitJITLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Admit a verified external identity
func NewAdmitJITLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AdmitJITLogic {
	return &AdmitJITLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AdmitJITLogic) AdmitJIT(req *types.AdmitJITReq) (resp *types.PrincipalResp, err error) {
	if req == nil || l.svcCtx.Identity == nil {
		return nil, fmt.Errorf("identity service is unavailable")
	}
	value, err := l.svcCtx.Identity.AdmitJIT(l.ctx, identityservice.JITInput{EnterpriseID: req.EnterpriseID, ApplicationID: req.ApplicationID, Issuer: req.Issuer, Subject: req.Subject, Email: req.Email, EmailVerified: req.EmailVerified, DisplayName: req.DisplayName})
	if err != nil {
		return nil, err
	}
	return principalResponse(value), nil
}
