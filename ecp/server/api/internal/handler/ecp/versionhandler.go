// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package ecp

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/ecp"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// Build and contract version
func VersionHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		l := ecp.NewVersionLogic(r.Context(), svcCtx)
		resp, err := l.Version()
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
