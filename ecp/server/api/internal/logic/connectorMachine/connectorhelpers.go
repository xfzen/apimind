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
	keys := make([]types.DelegationKeyItem, 0, len(value.Keys))
	for _, key := range value.Keys {
		keys = append(keys, types.DelegationKeyItem{KeyID: key.KeyID, Algorithm: key.Algorithm, PublicKey: key.PublicKey, NotBefore: key.NotBefore.Unix(), NotAfter: key.NotAfter.Unix(), Status: key.Status})
	}
	return &types.DelegationKeySetResp{Version: value.Version, Purpose: value.Purpose, PreviousVersion: value.PreviousVersion, PreviousFingerprint: value.PreviousFingerprint, Keys: keys, PayloadHash: value.PayloadHash, SigningKeyID: value.SigningKeyID, RootSignature: value.RootSignature, Fingerprint: value.Fingerprint, RootFingerprint: rootFingerprint}
}
