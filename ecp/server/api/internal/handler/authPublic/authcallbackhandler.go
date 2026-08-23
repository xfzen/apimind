// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package authPublic

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/authPublic"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// Complete an OIDC login transaction
func AuthCallbackHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.AuthCallbackReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := authPublic.NewAuthCallbackLogic(r.Context(), svcCtx)
		transactionID, transactionErr := cookieValue(r, transactionIDCookie)
		verifier, verifierErr := cookieValue(r, verifierCookie)
		nonce, nonceErr := cookieValue(r, nonceCookie)
		if transactionErr != nil || verifierErr != nil || nonceErr != nil {
			httpx.ErrorCtx(r.Context(), w, http.ErrNoCookie)
			return
		}
		resp, token, csrf, err := l.Complete(&req, transactionID, verifier, nonce)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			secure := !svcCtx.Config.OIDC.LocalMode
			setCookie(w, transactionIDCookie, "", "/api/v1/auth/callback", -1, secure, true, http.SameSiteLaxMode)
			setCookie(w, verifierCookie, "", "/api/v1/auth/callback", -1, secure, true, http.SameSiteLaxMode)
			setCookie(w, nonceCookie, "", "/api/v1/auth/callback", -1, secure, true, http.SameSiteLaxMode)
			setCookie(w, "ecp_admin_session", token, "/api/v1", 28800, secure, true, http.SameSiteStrictMode)
			setCookie(w, adminCSRFCookie, csrf, "/api/v1", 28800, secure, false, http.SameSiteStrictMode)
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
