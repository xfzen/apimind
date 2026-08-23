package ecp

import (
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
)

func principalResponse(value domain.Principal) *types.PrincipalResp {
	return &types.PrincipalResp{ID: value.ID, EnterpriseID: value.EnterpriseID, Issuer: value.Issuer, Subject: value.Subject, NormalizedEmail: value.NormalizedEmail, DisplayName: value.DisplayName, Status: value.Status, Version: value.Version}
}

func groupResponse(value domain.IdentityGroup) *types.GroupResp {
	return &types.GroupResp{ID: value.ID, EnterpriseID: value.EnterpriseID, Provider: value.Provider, ExternalID: value.ExternalID, Name: value.Name, ManagementMode: value.ManagementMode, DirectMemberVersion: value.DirectMemberVersion, Status: value.Status}
}
