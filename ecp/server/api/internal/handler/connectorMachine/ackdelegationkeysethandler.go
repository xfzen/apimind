// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package connectorMachine

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/connectorMachine"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// Acknowledge the exact accepted Delegation KeySet
func AckDelegationKeySetHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.AckDelegationKeySetReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := connectorMachine.NewAckDelegationKeySetLogic(r.Context(), svcCtx)
		resp, err := l.AckDelegationKeySet(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
