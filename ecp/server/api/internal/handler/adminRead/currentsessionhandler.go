// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/adminRead"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// Current admin session
func CurrentSessionHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		l := adminRead.NewCurrentSessionLogic(r.Context(), svcCtx)
		resp, err := l.CurrentSession()
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
