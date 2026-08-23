// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"context"
	"fmt"
	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
	policyservice "github.com/xfzen/ecp/server/internal/service/policy"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type ReconcilePoliciesLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Reconcile projected Casdoor policies
func NewReconcilePoliciesLogic(ctx context.Context, svcCtx *svc.ServiceContext) *ReconcilePoliciesLogic {
	return &ReconcilePoliciesLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *ReconcilePoliciesLogic) ReconcilePolicies(req *types.ReconcilePoliciesReq) (resp *types.PolicyProjectionResp, err error) {
	if req == nil || l.svcCtx.Policy == nil {
		return nil, fmt.Errorf("policy service is unavailable")
	}
	claims, ok := apiMiddleware.ClaimsFromContext(l.ctx)
	if !ok || claims.EnterpriseID != req.EnterpriseID {
		return nil, fmt.Errorf("enterprise_scope_mismatch")
	}
	policies := make([]casdoor.Policy, 0, len(req.Policies))
	for _, value := range req.Policies {
		policies = append(policies, casdoor.Policy{Owner: value.Owner, Name: value.Name, PType: value.PType, V0: value.V0, V1: value.V1, V2: value.V2, V3: value.V3, V4: value.V4, V5: value.V5})
	}
	projection, err := l.svcCtx.Policy.Reconcile(l.ctx, policyservice.ReconcileInput{EnterpriseID: req.EnterpriseID, ApplicationInstanceID: req.ApplicationInstanceID, CasdoorPermissionID: req.CasdoorPermissionID, ManifestVersion: req.ManifestVersion, Policies: policies})
	if err != nil {
		return nil, err
	}
	return &types.PolicyProjectionResp{ApplicationInstanceID: projection.ApplicationInstanceID, CasdoorPermissionID: projection.CasdoorPermissionID, NormalizedHash: projection.NormalizedHash, ManifestVersion: projection.ManifestVersion, PolicyVersion: projection.PolicyVersion, ReconciliationState: projection.ReconciliationState}, nil
}
