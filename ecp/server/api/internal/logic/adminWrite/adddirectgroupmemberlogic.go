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

type AddDirectGroupMemberLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Add one direct member to an ECP-managed group
func NewAddDirectGroupMemberLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AddDirectGroupMemberLogic {
	return &AddDirectGroupMemberLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AddDirectGroupMemberLogic) AddDirectGroupMember(req *types.AddGroupMemberReq) (resp *types.Empty, err error) {
	if req == nil || l.svcCtx.Identity == nil {
		return nil, fmt.Errorf("identity service is unavailable")
	}
	enterpriseID, scopeErr := requireEnterprise(l.ctx, req.EnterpriseID)
	if scopeErr != nil {
		return nil, scopeErr
	}
	if err := l.svcCtx.Identity.AddDirectGroupMember(l.ctx, enterpriseID, req.GroupID, req.PrincipalID); err != nil {
		return nil, err
	}
	return &types.Empty{}, nil
}
