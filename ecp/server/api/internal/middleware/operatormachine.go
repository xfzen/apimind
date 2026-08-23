package middleware

import (
	"context"
	"net/http"
	"strings"
)

type OperatorClaims struct {
	CredentialID string
	Scopes       []string
}
type operatorContextKey struct{}
type OperatorCredentialVerifier interface {
	VerifyOperatorCredential(context.Context, string, string) (OperatorClaims, error)
}
type OperatorMachineMiddleware struct{ verifier OperatorCredentialVerifier }

func NewOperatorMachine(verifier OperatorCredentialVerifier) *OperatorMachineMiddleware {
	return &OperatorMachineMiddleware{verifier: verifier}
}
func (m *OperatorMachineMiddleware) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		id := request.Header.Get("X-ECP-Operator-ID")
		authorization := request.Header.Get("Authorization")
		if m == nil || m.verifier == nil || id == "" || !strings.HasPrefix(authorization, "Bearer ") {
			deny(response, http.StatusUnauthorized, "operator_credential_required")
			return
		}
		claims, err := m.verifier.VerifyOperatorCredential(request.Context(), id, strings.TrimPrefix(authorization, "Bearer "))
		if err != nil {
			deny(response, http.StatusUnauthorized, "operator_credential_invalid")
			return
		}
		next.ServeHTTP(response, request.WithContext(context.WithValue(request.Context(), operatorContextKey{}, claims)))
	})
}
func OperatorClaimsFromContext(ctx context.Context) (OperatorClaims, bool) {
	value, ok := ctx.Value(operatorContextKey{}).(OperatorClaims)
	return value, ok
}
