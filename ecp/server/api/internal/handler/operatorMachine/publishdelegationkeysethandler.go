// Code scaffolded by goctl. Safe to edit.
// goctl 1.9.2

package operatorMachine

import (
	"net/http"

	"github.com/xfzen/ecp/server/api/internal/logic/operatorMachine"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// Publish an offline-root-signed Delegation KeySet
func PublishDelegationKeySetHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.PublishDelegationKeySetReq
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := operatorMachine.NewPublishDelegationKeySetLogic(r.Context(), svcCtx)
		resp, err := l.PublishDelegationKeySet(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
