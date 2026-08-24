package httpserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/zeromicro/go-zero/core/logx/logtest"
	"github.com/zeromicro/go-zero/rest"
)

func TestConfigureRequestLoggingDisablesGoZeroRequestDump(t *testing.T) {
	conf := rest.RestConf{Middlewares: rest.MiddlewaresConf{Log: true}}

	ConfigureRequestLogging(&conf)

	if conf.Middlewares.Log {
		t.Fatal("go-zero request dump middleware remains enabled")
	}
}

func TestRequestLogOmitsQueryHeadersAndBody(t *testing.T) {
	collector := logtest.NewCollector(t)
	request := httptest.NewRequest(http.MethodPost, "https://example.test/api/connector?token=query-secret", strings.NewReader("body-secret"))
	request.Header.Set("Authorization", "Bearer header-secret")
	request.Header.Set("X-ApiMind-Signature", "signature-secret")
	response := httptest.NewRecorder()

	RequestLog(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusInternalServerError)
	})).ServeHTTP(response, request)

	logged := collector.String()
	if !strings.Contains(logged, "POST /api/connector") {
		t.Fatalf("safe request summary missing: %s", logged)
	}
	for _, secret := range []string{"query-secret", "header-secret", "signature-secret", "body-secret"} {
		if strings.Contains(logged, secret) {
			t.Fatalf("request log contains secret %q: %s", secret, logged)
		}
	}
}
