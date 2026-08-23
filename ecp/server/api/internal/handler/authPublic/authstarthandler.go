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

// Begin an OIDC login transaction
func AuthStartHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.AuthStartReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := authPublic.NewAuthStartLogic(r.Context(), svcCtx)
		resp, transaction, err := l.Begin(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			secure := !svcCtx.Config.OIDC.LocalMode
			setCookie(w, transactionIDCookie, transaction.TransactionID, "/api/v1/auth/callback", 600, secure, true, http.SameSiteLaxMode)
			setCookie(w, verifierCookie, transaction.PKCEVerifier, "/api/v1/auth/callback", 600, secure, true, http.SameSiteLaxMode)
			setCookie(w, nonceCookie, transaction.Nonce, "/api/v1/auth/callback", 600, secure, true, http.SameSiteLaxMode)
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
