package adminRead

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	productresourceservice "github.com/xfzen/ecp/server/internal/service/productresource"
)

func productResourceActor(ctx context.Context) (productresourceservice.Actor, error) {
	claims, found := apiMiddleware.ClaimsFromContext(ctx)
	if !found || claims.EnterpriseID == "" || claims.PrincipalID == "" || claims.SessionID == "" {
		return productresourceservice.Actor{}, fmt.Errorf("admin_session_required")
	}
	return productresourceservice.Actor{EnterpriseID: claims.EnterpriseID, PrincipalID: claims.PrincipalID, SessionID: claims.SessionID}, nil
}

func productResourceAction(resourceType string) (string, error) {
	switch resourceType {
	case "workspace":
		return "workspace.member.manage", nil
	case "project":
		return "project.member.manage", nil
	default:
		return "", fmt.Errorf("product_resource_type_unsupported")
	}
}

func mapProductResource(value domain.ResourceReference) types.ProductResourceItem {
	return types.ProductResourceItem{Type: value.ResourceType, ID: value.ExternalID, Name: value.DisplayName, ParentID: value.ParentExternalID, Version: value.ResourceVersion}
}
