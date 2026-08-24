package middleware

import (
	"context"
	"net/http"
	"strings"
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
type AdminFreshnessChecker interface {
	AssertAdminFresh(context.Context, string, string) error
}

type AdminSessionMiddleware struct {
	resolver  SessionResolver
	freshness AdminFreshnessChecker
}

func NewAdminSession(resolver SessionResolver, freshness ...AdminFreshnessChecker) *AdminSessionMiddleware {
	value := &AdminSessionMiddleware{resolver: resolver}
	if len(freshness) > 0 {
		value.freshness = freshness[0]
	}
	return value
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
		if m.freshness != nil {
			if err := m.freshness.AssertAdminFresh(request.Context(), value.EnterpriseID, value.PrincipalID); err != nil {
				reason := "identity_state_unavailable"
				for _, candidate := range []string{"principal_blocked", "principal_pending_external_sync", "identity_state_stale"} {
					if strings.Contains(err.Error(), candidate) {
						reason = candidate
						break
					}
				}
				deny(response, http.StatusForbidden, reason)
				return
			}
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
