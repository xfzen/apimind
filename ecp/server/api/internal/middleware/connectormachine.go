package middleware

import (
	"context"
	"net/http"
	"strings"
)

type ConnectorClaims struct{ EnterpriseID, ApplicationInstanceID, ConnectorID string }
type connectorContextKey struct{}
type ConnectorCredentialVerifier interface {
	VerifyConnectorCredential(context.Context, string, string) (ConnectorClaims, error)
}
type ConnectorMachineMiddleware struct{ verifier ConnectorCredentialVerifier }

func NewConnectorMachine(verifier ConnectorCredentialVerifier) *ConnectorMachineMiddleware {
	return &ConnectorMachineMiddleware{verifier: verifier}
}
func (m *ConnectorMachineMiddleware) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		connectorID := request.Header.Get("X-ECP-Connector-ID")
		authorization := request.Header.Get("Authorization")
		if m == nil || m.verifier == nil || connectorID == "" || !strings.HasPrefix(authorization, "Bearer ") {
			deny(response, http.StatusUnauthorized, "connector_credential_required")
			return
		}
		claims, err := m.verifier.VerifyConnectorCredential(request.Context(), connectorID, strings.TrimPrefix(authorization, "Bearer "))
		if err != nil {
			deny(response, http.StatusUnauthorized, "connector_credential_invalid")
			return
		}
		next.ServeHTTP(response, request.WithContext(context.WithValue(request.Context(), connectorContextKey{}, claims)))
	})
}

func ConnectorClaimsFromContext(ctx context.Context) (ConnectorClaims, bool) {
	value, ok := ctx.Value(connectorContextKey{}).(ConnectorClaims)
	return value, ok
}
