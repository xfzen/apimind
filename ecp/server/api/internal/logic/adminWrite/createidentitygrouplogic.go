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

type CreateIdentityGroupLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Create an ECP-managed direct group
func NewCreateIdentityGroupLogic(ctx context.Context, svcCtx *svc.ServiceContext) *CreateIdentityGroupLogic {
	return &CreateIdentityGroupLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *CreateIdentityGroupLogic) CreateIdentityGroup(req *types.CreateGroupReq) (resp *types.GroupResp, err error) {
	if req == nil || l.svcCtx.Identity == nil {
		return nil, fmt.Errorf("identity service is unavailable")
	}
	enterpriseID, scopeErr := requireEnterprise(l.ctx, req.EnterpriseID)
	if scopeErr != nil {
		return nil, scopeErr
	}
	value, err := l.svcCtx.Identity.CreateManagedGroup(l.ctx, identityservice.ManagedGroupInput{EnterpriseID: enterpriseID, Name: req.Name})
	if err != nil {
		return nil, err
	}
	return groupResponse(value), nil
}
