// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"crypto/subtle"
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/adminRead"
	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	sessionservice "github.com/xfzen/ecp/server/internal/service/session"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// Current admin session
func CurrentSessionHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		csrf, cookieErr := r.Cookie("ecp_admin_csrf")
		claims, claimsOK := apiMiddleware.ClaimsFromContext(r.Context())
		if cookieErr != nil || !claimsOK || subtle.ConstantTimeCompare([]byte(claims.CSRFHash), []byte(sessionservice.HashToken(csrf.Value))) != 1 {
			http.Error(w, "csrf_session_required", http.StatusUnauthorized)
			return
		}
		l := adminRead.NewCurrentSessionLogic(r.Context(), svcCtx)
		resp, err := l.CurrentSession()
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			resp.CSRFToken = csrf.Value
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
