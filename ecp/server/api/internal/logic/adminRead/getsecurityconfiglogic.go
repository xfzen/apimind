// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"fmt"
	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type GetSecurityConfigLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Get instance security controls
func NewGetSecurityConfigLogic(ctx context.Context, svcCtx *svc.ServiceContext) *GetSecurityConfigLogic {
	return &GetSecurityConfigLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *GetSecurityConfigLogic) GetSecurityConfig(req *types.SecurityConfigReq) (resp *types.SecurityConfigResp, err error) {
	if req == nil || l.svcCtx.SecurityConfig == nil {
		return nil, fmt.Errorf("security config service is unavailable")
	}
	claims, ok := apiMiddleware.ClaimsFromContext(l.ctx)
	if !ok || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	value, err := l.svcCtx.SecurityConfig.Get(l.ctx, req.EnterpriseID, req.ApplicationInstanceID)
	if err != nil {
		return nil, err
	}
	return &types.SecurityConfigResp{EnterpriseID: value.EnterpriseID, ApplicationInstanceID: value.ApplicationInstanceID, PublicSharing: value.PublicSharing, ExportEnabled: value.ExportEnabled, SecretExport: value.SecretExport, Version: value.Version}, nil
}
