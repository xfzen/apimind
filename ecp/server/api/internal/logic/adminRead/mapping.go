package adminRead

import (
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
)

func mapPrincipal(value domain.Principal) types.PrincipalResp {
	return types.PrincipalResp{ID: value.ID, EnterpriseID: value.EnterpriseID, Issuer: value.Issuer, Subject: value.Subject, NormalizedEmail: value.NormalizedEmail, DisplayName: value.DisplayName, Status: value.Status, Version: value.Version}
}
func mapGroup(value domain.IdentityGroup) types.GroupResp {
	return types.GroupResp{ID: value.ID, EnterpriseID: value.EnterpriseID, Provider: value.Provider, ExternalID: value.ExternalID, Name: value.Name, ManagementMode: value.ManagementMode, DirectMemberVersion: value.DirectMemberVersion, Status: value.Status}
}
func mapApplication(value domain.Application) types.ApplicationResp {
	return types.ApplicationResp{ID: value.ID, EnterpriseID: value.EnterpriseID, Key: value.Key, Name: value.Name, Status: value.Status, Version: value.Version}
}
func mapInstance(value domain.ApplicationInstance) types.InstanceResp {
	return types.InstanceResp{ID: value.ID, EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, InstanceKey: value.InstanceKey, Environment: value.Environment, CanonicalURL: value.CanonicalURL, Status: value.Status, Version: value.Version}
}
