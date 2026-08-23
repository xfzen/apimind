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

// List registered applications
func ListApplicationsHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.AdminEnterpriseReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := adminRead.NewListApplicationsLogic(r.Context(), svcCtx)
		resp, err := l.ListApplications(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
