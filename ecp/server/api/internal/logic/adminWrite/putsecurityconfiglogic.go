// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"
	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	securityconfigservice "github.com/xfzen/ecp/server/internal/service/securityconfig"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type PutSecurityConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Put instance security controls
func NewPutSecurityConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *PutSecurityConfigLogic {
	return &PutSecurityConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *PutSecurityConfigLogic) PutSecurityConfig(req *types.PutSecurityConfigReq) (resp *types.SecurityConfigResp, err error) {
	if req == nil || l.svcCtx.SecurityConfig == nil {
		return nil, fmt.Errorf("security config service is unavailable")
	}
	claims, ok := apiMiddleware.ClaimsFromContext(l.ctx)
	if !ok || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	value, err := l.svcCtx.SecurityConfig.Put(l.ctx, securityconfigservice.PutInput{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, PublicSharing: req.PublicSharing, ExportEnabled: req.ExportEnabled, SecretExport: req.SecretExport})
	if err != nil {
		return nil, err
	}
	return &types.SecurityConfigResp{EnterpriseID: value.EnterpriseID, ApplicationInstanceID: value.ApplicationInstanceID, PublicSharing: value.PublicSharing, ExportEnabled: value.ExportEnabled, SecretExport: value.SecretExport, Version: value.Version}, nil
}
