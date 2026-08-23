package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"
)

type rateBucket struct {
	started time.Time
	count   int
}
type RateLimitMiddleware struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	buckets map[string]rateBucket
	now     func() time.Time
}

func NewRateLimit(limit int, window time.Duration) *RateLimitMiddleware {
	if limit <= 0 {
		limit = 30
	}
	if window <= 0 {
		window = time.Minute
	}
	return &RateLimitMiddleware{limit: limit, window: window, buckets: make(map[string]rateBucket), now: time.Now}
}
func (m *RateLimitMiddleware) Handle(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if !m.allow(rateKey(request)) {
			deny(response, http.StatusTooManyRequests, "rate_limit_exceeded")
			return
		}
		next.ServeHTTP(response, request)
	})
}
func (m *RateLimitMiddleware) allow(key string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	value := m.buckets[key]
	if value.started.IsZero() || now.Sub(value.started) >= m.window {
		value = rateBucket{started: now}
	}
	if value.count >= m.limit {
		m.buckets[key] = value
		return false
	}
	value.count++
	m.buckets[key] = value
	return true
}
func rateKey(request *http.Request) string {
	claims, ok := ClaimsFromContext(request.Context())
	if ok && claims.PrincipalID != "" {
		return claims.PrincipalID + "|" + request.URL.Path
	}
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err != nil {
		host = request.RemoteAddr
	}
	return host + "|" + request.URL.Path
}
