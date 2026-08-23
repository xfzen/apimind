package middleware

import (
	"crypto/subtle"
	"net/http"

	"github.com/xfzen/ecp/server/internal/service/session"
)

type CSRFMiddleware struct{}

func NewCSRF() *CSRFMiddleware { return &CSRFMiddleware{} }
func (m *CSRFMiddleware) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		claims, ok := ClaimsFromContext(request.Context())
		raw := request.Header.Get("X-CSRF-Token")
		actual := session.HashToken(raw)
		if !ok || raw == "" || subtle.ConstantTimeCompare([]byte(claims.CSRFHash), []byte(actual)) != 1 {
			deny(response, http.StatusForbidden, "csrf_required")
			return
		}
		next.ServeHTTP(response, request)
	})
}
