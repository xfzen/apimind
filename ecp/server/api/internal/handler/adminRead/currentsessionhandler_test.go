package adminRead

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/api/internal/svc"
	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/service/session"
)

type currentSessionResolver struct{ value domain.Session }

func (r currentSessionResolver) Resolve(context.Context, string, string) (domain.Session, error) {
	return r.value, nil
}

func TestCurrentSessionReturnsSessionBoundCSRFToken(t *testing.T) {
	csrf := "csrf-token"
	value := domain.Session{Base: domain.Base{ID: "ses-1", EnterpriseID: "ent-1"}, PrincipalID: "pri-1", Kind: domain.SessionKindAdmin, CSRFHash: session.HashToken(csrf), ExpiresAt: time.Now().Add(time.Hour)}
	handler := apiMiddleware.NewAdminSession(currentSessionResolver{value: value}).Handle(CurrentSessionHandler(&svc.ServiceContext{}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/session", nil)
	req.AddCookie(&http.Cookie{Name: session.AdminCookieName, Value: "session-token"})
	req.AddCookie(&http.Cookie{Name: "ecp_admin_csrf", Value: csrf})
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	var response types.SessionSummaryResp
	if err := json.Unmarshal(res.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.CSRFToken != csrf || response.EnterpriseID != "ent-1" {
		t.Fatalf("response=%+v", response)
	}
}

func TestCurrentSessionRejectsMissingCSRFCookie(t *testing.T) {
	value := domain.Session{Base: domain.Base{ID: "ses-1", EnterpriseID: "ent-1"}, PrincipalID: "pri-1", Kind: domain.SessionKindAdmin, CSRFHash: session.HashToken("csrf-token"), ExpiresAt: time.Now().Add(time.Hour)}
	handler := apiMiddleware.NewAdminSession(currentSessionResolver{value: value}).Handle(CurrentSessionHandler(&svc.ServiceContext{}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/session", nil)
	req.AddCookie(&http.Cookie{Name: session.AdminCookieName, Value: "session-token"})
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d", res.Code)
	}
}
