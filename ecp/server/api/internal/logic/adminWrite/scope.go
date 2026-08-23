package adminWrite

import (
	"context"
	"fmt"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
)

func requireEnterprise(ctx context.Context, requested string) (string, error) {
	claims, ok := apiMiddleware.ClaimsFromContext(ctx)
	if !ok || claims.EnterpriseID == "" || requested == "" || requested != claims.EnterpriseID {
		return "", fmt.Errorf("enterprise_scope_mismatch")
	}
	return claims.EnterpriseID, nil
}

func sessionEnterprise(ctx context.Context) (string, error) {
	claims, ok := apiMiddleware.ClaimsFromContext(ctx)
	if !ok || claims.EnterpriseID == "" {
		return "", fmt.Errorf("enterprise_scope_mismatch")
	}
	return claims.EnterpriseID, nil
}
