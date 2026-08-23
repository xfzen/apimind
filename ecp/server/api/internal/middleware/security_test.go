package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBrowserWriteRejectsMissingCSRF(t *testing.T) {
	handler := SessionContext("session-1", "csrf-token", http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) { response.WriteHeader(http.StatusNoContent) }))
	handler = NewCSRF().Handle(handler)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/identity/block", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", response.Code)
	}
	if response.Header().Get("X-ECP-Reason") != "csrf_required" {
		t.Fatalf("reason=%q", response.Header().Get("X-ECP-Reason"))
	}
}

func TestBrowserWriteAcceptsSessionBoundCSRF(t *testing.T) {
	protected := NewCSRF().Handle(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) { response.WriteHeader(http.StatusNoContent) }))
	handler := SessionContext("session-1", "csrf-token", protected)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/identity/block", nil)
	request.Header.Set("X-CSRF-Token", "csrf-token")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("status=%d", response.Code)
	}
}

func TestWriteHeadersRequireIdempotencyAndOperationIDs(t *testing.T) {
	handler := NewIdempotencyHeaders().Handle(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) { response.WriteHeader(http.StatusNoContent) }))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/identity/block", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest || response.Header().Get("X-ECP-Reason") != "idempotency_key_required" {
		t.Fatalf("status=%d reason=%q", response.Code, response.Header().Get("X-ECP-Reason"))
	}
}

func TestWriteHeadersExposeOperationIDToAuditLogic(t *testing.T) {
	var observed string
	handler := NewIdempotencyHeaders().Handle(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		observed, _ = OperationIDFromContext(request.Context())
		response.WriteHeader(http.StatusNoContent)
	}))
	request := httptest.NewRequest(http.MethodPost, "/api/v1/identity/block", nil)
	request.Header.Set("Idempotency-Key", "idem-1")
	request.Header.Set("Operation-ID", "operation-1")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent || observed != "operation-1" {
		t.Fatalf("status=%d operation=%q", response.Code, observed)
	}
}

func TestGeneratedRoutesKeepWritesOutOfPublicGroups(t *testing.T) {
	routes, err := os.ReadFile(filepath.Join("..", "handler", "routes.go"))
	if err != nil {
		t.Fatal(err)
	}
	body := string(routes)
	for _, required := range []string{
		"[]rest.Middleware{serverCtx.AdminSession, serverCtx.CSRF, serverCtx.IdempotencyHeaders, serverCtx.RateLimit}",
		"[]rest.Middleware{serverCtx.ConnectorMachine, serverCtx.IdempotencyHeaders, serverCtx.RateLimit}",
		"[]rest.Middleware{serverCtx.AdminSession}",
	} {
		if !strings.Contains(body, required) {
			t.Fatalf("generated routes missing %q", required)
		}
	}
	for _, forbidden := range []string{"Path:    \"/identity/jit\",\n\t\t\t\tHandler: authPublic", "Path:    \"/connectors/register\",\n\t\t\t\tHandler: authPublic"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("public group contains protected route %q", forbidden)
		}
	}
}
