package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/service/session"
)

type sessionContextKey struct{}

type SessionClaims struct {
	SessionID, EnterpriseID, PrincipalID, CSRFHash string
	ExpiresAt                                      time.Time
}

type SessionResolver interface {
	Resolve(context.Context, string, string) (domain.Session, error)
}

type AdminSessionMiddleware struct{ resolver SessionResolver }

func NewAdminSession(resolver SessionResolver) *AdminSessionMiddleware {
	return &AdminSessionMiddleware{resolver: resolver}
}

func (m *AdminSessionMiddleware) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		cookie, err := request.Cookie(session.AdminCookieName)
		if err != nil || m == nil || m.resolver == nil {
			deny(response, http.StatusUnauthorized, "admin_session_required")
			return
		}
		value, err := m.resolver.Resolve(request.Context(), cookie.Value, session.AdminSession)
		if err != nil {
			deny(response, http.StatusUnauthorized, "admin_session_invalid")
			return
		}
		claims := SessionClaims{SessionID: value.ID, EnterpriseID: value.EnterpriseID, PrincipalID: value.PrincipalID, CSRFHash: value.CSRFHash, ExpiresAt: value.ExpiresAt}
		next.ServeHTTP(response, request.WithContext(context.WithValue(request.Context(), sessionContextKey{}, claims)))
	})
}

func ClaimsFromContext(ctx context.Context) (SessionClaims, bool) {
	value, ok := ctx.Value(sessionContextKey{}).(SessionClaims)
	return value, ok
}

func SessionContext(sessionID, csrfToken string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		claims := SessionClaims{SessionID: sessionID, CSRFHash: session.HashToken(csrfToken)}
		next.ServeHTTP(response, request.WithContext(context.WithValue(request.Context(), sessionContextKey{}, claims)))
	})
}
