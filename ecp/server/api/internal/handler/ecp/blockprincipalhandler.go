// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package ecp

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/ecp"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// Block a principal locally
func BlockPrincipalHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.BlockPrincipalReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := ecp.NewBlockPrincipalLogic(r.Context(), svcCtx)
		resp, err := l.BlockPrincipal(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
