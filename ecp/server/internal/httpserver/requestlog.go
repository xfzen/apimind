package httpserver

import (
	"net/http"
	"time"

	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/rest"
	"github.com/zeromicro/go-zero/rest/httpx"
)

// ConfigureRequestLogging disables go-zero's request dump, which includes
// headers and request bodies for server errors. RequestLog provides the safe
// summary used by ECP instead.
func ConfigureRequestLogging(conf *rest.RestConf) {
	conf.Middlewares.Log = false
}

// RequestLog records only non-sensitive request metadata. Query strings,
// headers, and request bodies are deliberately excluded.
func RequestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		started := time.Now()
		next.ServeHTTP(writer, request)
		logx.WithContext(request.Context()).WithDuration(time.Since(started)).Infof(
			"[HTTP] %s %s - %s",
			request.Method,
			request.URL.Path,
			httpx.GetRemoteAddr(request),
		)
	})
}
