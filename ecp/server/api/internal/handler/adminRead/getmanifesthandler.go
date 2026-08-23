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

// Get the accepted product manifest
func GetManifestHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.AdminEntityReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := adminRead.NewGetManifestLogic(r.Context(), svcCtx)
		resp, err := l.GetManifest(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
