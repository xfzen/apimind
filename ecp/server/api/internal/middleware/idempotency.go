package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	idempotencyservice "github.com/xfzen/ecp/server/internal/service/idempotency"
)

type IdempotencyHeadersMiddleware struct{ service *idempotencyservice.Service }

func NewIdempotencyHeaders() *IdempotencyHeadersMiddleware { return &IdempotencyHeadersMiddleware{} }
func NewIdempotency(service *idempotencyservice.Service) *IdempotencyHeadersMiddleware {
	return &IdempotencyHeadersMiddleware{service: service}
}

func (m *IdempotencyHeadersMiddleware) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodGet || request.Method == http.MethodHead || request.Method == http.MethodOptions {
			next.ServeHTTP(response, request)
			return
		}
		key, operationID := request.Header.Get("Idempotency-Key"), request.Header.Get("Operation-ID")
		if key == "" {
			deny(response, http.StatusBadRequest, "idempotency_key_required")
			return
		}
		if operationID == "" {
			deny(response, http.StatusBadRequest, "operation_id_required")
			return
		}
		if m == nil || m.service == nil {
			next.ServeHTTP(response, request)
			return
		}
		enterpriseID := ""
		if claims, ok := ClaimsFromContext(request.Context()); ok {
			enterpriseID = claims.EnterpriseID
		}
		if claims, ok := ConnectorClaimsFromContext(request.Context()); ok {
			enterpriseID = claims.EnterpriseID
		}
		if enterpriseID == "" {
			deny(response, http.StatusUnauthorized, "idempotency_scope_required")
			return
		}
		payload, err := io.ReadAll(io.LimitReader(request.Body, 1<<20))
		if err != nil {
			deny(response, http.StatusBadRequest, "request_body_invalid")
			return
		}
		request.Body = io.NopCloser(bytes.NewReader(payload))
		record, err := m.service.Begin(request.Context(), idempotencyservice.BeginInput{EnterpriseID: enterpriseID, OperationID: operationID, Key: key, Method: request.Method, CanonicalPath: request.URL.EscapedPath(), Payload: payload})
		if err != nil {
			reason := "idempotency_conflict"
			for _, candidate := range []string{"idempotency_payload_mismatch", "idempotency_replay", "idempotency_in_progress"} {
				if strings.Contains(err.Error(), candidate) {
					reason = candidate
					break
				}
			}
			deny(response, http.StatusConflict, reason)
			return
		}
		observer := &responseObserver{ResponseWriter: response, status: http.StatusOK}
		next.ServeHTTP(observer, request)
		_, _ = m.service.Complete(request.Context(), record, observer.status, observer.body.Bytes())
	})
}

type responseObserver struct {
	http.ResponseWriter
	status int
	body   bytes.Buffer
}

func (w *responseObserver) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (w *responseObserver) Write(value []byte) (int, error) {
	if w.body.Len() < 1<<20 {
		remaining := (1 << 20) - w.body.Len()
		if len(value) < remaining {
			remaining = len(value)
		}
		_, _ = w.body.Write(value[:remaining])
	}
	return w.ResponseWriter.Write(value)
}

func deny(response http.ResponseWriter, status int, reason string) {
	response.Header().Set("Content-Type", "application/json")
	response.Header().Set("X-ECP-Reason", reason)
	response.WriteHeader(status)
	_, _ = response.Write([]byte(`{"reason":"` + reason + `"}`))
}
