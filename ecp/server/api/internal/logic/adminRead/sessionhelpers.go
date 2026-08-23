package adminRead

import (
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
)

func sessionSummary(value domain.Session) types.SessionSummaryResp {
	return types.SessionSummaryResp{ID: value.ID, EnterpriseID: value.EnterpriseID, PrincipalID: value.PrincipalID, ApplicationInstanceID: value.ApplicationInstanceID, Kind: value.Kind, ExpiresAt: value.ExpiresAt.Unix(), Revoked: value.RevokedAt != nil}
}
