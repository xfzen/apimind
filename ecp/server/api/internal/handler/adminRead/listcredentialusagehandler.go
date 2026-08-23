// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminRead

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/adminRead"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// List service credential usage without secret material
func ListCredentialUsageHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.CredentialUsageReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := adminRead.NewListCredentialUsageLogic(r.Context(), svcCtx)
		resp, err := l.ListCredentialUsage(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
