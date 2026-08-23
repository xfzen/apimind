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

// Create an ECP-managed direct group
func CreateIdentityGroupHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.CreateGroupReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := ecp.NewCreateIdentityGroupLogic(r.Context(), svcCtx)
		resp, err := l.CreateIdentityGroup(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
