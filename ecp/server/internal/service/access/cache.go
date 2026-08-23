package access

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type cacheEntry struct {
	decision  domain.AuthorizationDecision
	expiresAt time.Time
}
type Cache struct {
	mu     sync.RWMutex
	values map[string]cacheEntry
	clock  Clock
}

func NewCache(clock Clock) *Cache { return &Cache{values: make(map[string]cacheEntry), clock: clock} }
func (c *Cache) Get(key string) (domain.AuthorizationDecision, bool) {
	c.mu.RLock()
	value, ok := c.values[key]
	c.mu.RUnlock()
	if !ok || !c.clock.Now().Before(value.expiresAt) {
		if ok {
			c.mu.Lock()
			delete(c.values, key)
			c.mu.Unlock()
		}
		return domain.AuthorizationDecision{}, false
	}
	return value.decision, true
}
func (c *Cache) Put(key string, decision domain.AuthorizationDecision, expiresAt time.Time) {
	c.mu.Lock()
	c.values[key] = cacheEntry{decision: decision, expiresAt: expiresAt}
	c.mu.Unlock()
}
func (c *Cache) InvalidateEnterprise(enterpriseID string) {
	prefix := enterpriseID + "|"
	c.mu.Lock()
	for key := range c.values {
		if strings.HasPrefix(key, prefix) {
			delete(c.values, key)
		}
	}
	c.mu.Unlock()
}
func cacheKey(request domain.AuthorizationRequest, state domain.AccessState, projection domain.PolicyProjection, configVersion uint64) string {
	return fmt.Sprintf("%s|%s|%s|%d|%s|%s|%d|%d|%d|%d|%d", request.EnterpriseID, request.ApplicationInstanceID, request.PrincipalID, request.DirectGroupVersion, request.Action, request.ResourceID, request.ResourceVersion, state.LifecycleVersion, state.IdentitySyncVersion, projection.PolicyVersion, configVersion)
}
