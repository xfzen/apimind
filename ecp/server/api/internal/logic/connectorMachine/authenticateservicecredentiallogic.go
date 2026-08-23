// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	machineauthservice "github.com/xfzen/ecp/server/internal/service/machineauth"

	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"

	"github.com/zeromicro/go-zero/core/logx"
)

type AuthenticateServiceCredentialLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

// Authenticate a service credential and authorize one product operation
func NewAuthenticateServiceCredentialLogic(ctx context.Context, svcCtx *svc.ServiceContext) *AuthenticateServiceCredentialLogic {
	return &AuthenticateServiceCredentialLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *AuthenticateServiceCredentialLogic) AuthenticateServiceCredential(req *types.AuthenticateServiceCredentialReq) (resp *types.AuthenticateServiceCredentialResp, err error) {
	if req == nil || l.svcCtx.MachineAuth == nil {
		return nil, fmt.Errorf("machine authorization service is unavailable")
	}
	claims, ok := apiMiddleware.ConnectorClaimsFromContext(l.ctx)
	if !ok || !hasScope(claims.Scopes, "service_credential.authenticate") {
		return nil, fmt.Errorf("connector_scope_denied")
	}
	result, err := l.svcCtx.MachineAuth.AuthenticateAndAuthorize(l.ctx, machineauthservice.Boundary{
		EnterpriseID: claims.EnterpriseID, ApplicationID: claims.ApplicationID, ApplicationInstanceID: claims.ApplicationInstanceID,
	}, req.Credential, machineauthservice.ResourceRequest{
		ResourceType: req.ResourceType, ResourceID: req.ResourceID, Action: req.Action, ResourceVersion: req.ResourceVersion,
	})
	if err != nil {
		return nil, err
	}
	return &types.AuthenticateServiceCredentialResp{PrincipalID: result.PrincipalID, Decision: decisionResponse(result.Decision)}, nil
}
