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

// Resolve one product resource visible to the current enterprise administrator
func ResolveProductResourceHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.ProductResourceReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := adminRead.NewResolveProductResourceLogic(r.Context(), svcCtx)
		resp, err := l.ResolveProductResource(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
