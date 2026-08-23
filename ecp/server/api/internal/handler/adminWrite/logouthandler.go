// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/adminWrite"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// End the current admin session
func LogoutHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		l := adminWrite.NewLogoutLogic(r.Context(), svcCtx)
		resp, err := l.Logout()
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			secure := !svcCtx.Config.OIDC.LocalMode
			http.SetCookie(w, &http.Cookie{Name: "ecp_admin_session", Value: "", Path: "/api/v1", MaxAge: -1, Secure: secure, HttpOnly: true, SameSite: http.SameSiteStrictMode})
			http.SetCookie(w, &http.Cookie{Name: "ecp_admin_csrf", Value: "", Path: "/api/v1", MaxAge: -1, Secure: secure, SameSite: http.SameSiteStrictMode})
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
