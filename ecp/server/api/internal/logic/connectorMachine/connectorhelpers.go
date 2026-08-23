package connectorMachine

import (
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	connectorservice "github.com/xfzen/ecp/server/internal/service/connector"
)

func connectorClaims(value apiMiddleware.ConnectorClaims, scope string) (connectorservice.Claims, error) {
	if value.ConnectorID == "" || !hasScope(value.Scopes, scope) {
		return connectorservice.Claims{}, fmt.Errorf("connector_scope_denied")
	}
	return connectorservice.Claims{ConnectorID: value.ConnectorID, EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, InstanceID: value.ApplicationInstanceID, Channel: value.Channel, Scopes: value.Scopes}, nil
}
func hasScope(values []string, scope string) bool {
	for _, value := range values {
		if value == scope {
			return true
		}
	}
	return false
}
func keySetResponse(value domain.DelegationKeySet, rootFingerprint string) *types.DelegationKeySetResp {
	_ = rootFingerprint
	return &types.DelegationKeySetResp{Algorithm: value.Algorithm, SigningKeyID: value.SigningKeyID, Payload: append([]byte(nil), value.SignedPayload...), Signature: value.RootSignature}
}
