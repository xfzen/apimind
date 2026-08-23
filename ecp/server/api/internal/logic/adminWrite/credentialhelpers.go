package adminWrite

import (
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	credentialservice "github.com/xfzen/ecp/server/internal/service/credential"
)

func credentialScopes(values []types.CredentialScopeItem) []domain.CredentialScope {
	result := make([]domain.CredentialScope, 0, len(values))
	for _, value := range values {
		result = append(result, domain.CredentialScope{ResourceType: value.ResourceType, ResourceID: value.ResourceID, Actions: append([]string(nil), value.Actions...)})
	}
	return result
}
func createdCredential(value credentialservice.Created) *types.CredentialResp {
	scopes := make([]types.CredentialScopeItem, 0, len(value.Scopes))
	for _, scope := range value.Scopes {
		scopes = append(scopes, types.CredentialScopeItem{ResourceType: scope.ResourceType, ResourceID: scope.ResourceID, Actions: append([]string(nil), scope.Actions...)})
	}
	return &types.CredentialResp{ID: value.ID, EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, ApplicationInstanceID: value.ApplicationInstanceID, Name: value.Name, Secret: value.Secret, Scopes: scopes, Status: "active", RotationLineage: value.RotationLineage, ExpiresAt: value.ExpiresAt.Unix(), Version: 1}
}
