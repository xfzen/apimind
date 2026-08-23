// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package adminWrite

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/adminWrite"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// Safely offboard one product instance without deleting product data
func OffboardInstanceHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.InstanceOperationReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := adminWrite.NewOffboardInstanceLogic(r.Context(), svcCtx)
		resp, err := l.OffboardInstance(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
