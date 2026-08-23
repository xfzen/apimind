// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"

	"github.com/zeromicro/go-zero/core/logx"
)

type ListCredentialUsageLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// List service credential usage without secret material
func NewListCredentialUsageLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ListCredentialUsageLogic {
	return &ListCredentialUsageLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ListCredentialUsageLogic) ListCredentialUsage(req *types.CredentialUsageReq) (resp *types.CredentialUsageResp, err error) {
	if req == nil || l.svcCtx.Credential == nil {
		return nil, fmt.Errorf("credential service unavailable")
	}
	values, err := l.svcCtx.Credential.ListUsage(l.ctx, req.EnterpriseID, req.ApplicationInstanceID)
	if err != nil {
		return nil, err
	}
	result := make([]types.CredentialResp, 0, len(values))
	for _, value := range values {
		var scopes []domain.CredentialScope
		if err := json.Unmarshal(value.ScopesJSON, &scopes); err != nil {
			return nil, err
		}
		items := make([]types.CredentialScopeItem, 0, len(scopes))
		for _, scope := range scopes {
			items = append(items, types.CredentialScopeItem{ResourceType: scope.ResourceType, ResourceID: scope.ResourceID, Actions: scope.Actions})
		}
		item := types.CredentialResp{ID: value.ID, EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, ApplicationInstanceID: value.ApplicationInstanceID, Name: value.Name, Scopes: items, Status: value.Status, RotationLineage: value.RotationLineage, ExpiresAt: value.ExpiresAt.Unix(), Version: value.Version}
		if value.OverlapUntil != nil {
			item.OverlapUntil = value.OverlapUntil.Unix()
		}
		if value.LastUsedAt != nil {
			item.LastUsedAt = value.LastUsedAt.Unix()
		}
		result = append(result, item)
	}
	return &types.CredentialUsageResp{Credentials: result}, nil
}
