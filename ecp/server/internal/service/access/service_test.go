package access

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time              { return c.now }
func (c *fakeClock) Advance(value time.Duration) { c.now = c.now.Add(value) }

type fakeEngine struct {
	allow bool
	err   error
	calls int
}

func (e *fakeEngine) Authorize(_ context.Context, _ domain.AuthorizationRequest) (bool, error) {
	e.calls++
	return e.allow, e.err
}

type fakeStore struct {
	boundary   bool
	state      domain.AccessState
	projection domain.PolicyProjection
	config     domain.SecurityConfig
	err        error
}

func (s fakeStore) BoundaryExists(context.Context, string, string) (bool, error) {
	return s.boundary, s.err
}
func (s fakeStore) GetAccessState(context.Context, string, string, string) (domain.AccessState, error) {
	return s.state, s.err
}
func (s fakeStore) GetPolicyProjection(context.Context, string, string) (domain.PolicyProjection, bool, error) {
	return s.projection, s.projection.ID != "", s.err
}
func (s fakeStore) GetSecurityConfig(context.Context, string, string) (domain.SecurityConfig, bool, error) {
	return s.config, s.config.ID != "", s.err
}

func baseFixture(clock *fakeClock) (*Service, *fakeEngine) {
	engine := &fakeEngine{allow: true}
	store := fakeStore{boundary: true, state: domain.AccessState{LifecycleState: "active", LifecycleVersion: 1, IdentitySyncVersion: 1, IdentityFreshnessDeadline: clock.Now().Add(5 * time.Minute)}, projection: domain.PolicyProjection{Base: domain.Base{ID: "pol-1", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", PolicyVersion: 1, ReconciliationState: "in_sync"}, config: domain.SecurityConfig{Base: domain.Base{ID: "sec-1", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", Version: 1}}
	return New(store, engine, NewCache(clock), clock), engine
}

func requestFor(action string) domain.AuthorizationRequest {
	return domain.AuthorizationRequest{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", PrincipalID: "principal-1", PrincipalKind: "human", IdentityProvider: "casdoor", Action: action, ResourceID: "project-1", ResourceVersion: 1, DirectGroupVersion: 1}
}

func TestBlockedPrincipalOverridesPolicyAllow(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, engine := baseFixture(clock)
	store := service.store.(fakeStore)
	store.state.LifecycleState = "blocked"
	service.store = store
	decision, err := service.Authorize(context.Background(), requestFor("project.read"))
	if err != nil {
		t.Fatal(err)
	}
	if decision.Allow || decision.Reason != "principal_blocked" || engine.calls != 0 {
		t.Fatalf("decision=%+v calls=%d", decision, engine.calls)
	}
}

func TestPolicyDriftDeniesReadAndResourceDiscovery(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, _ := baseFixture(clock)
	store := service.store.(fakeStore)
	store.projection.ReconciliationState = "drifted"
	service.store = store
	for _, action := range []string{"project.read", "resource.search"} {
		decision, err := service.Authorize(context.Background(), requestFor(action))
		if err != nil || decision.Allow || decision.Reason != "policy_drift" {
			t.Fatalf("action=%s decision=%+v err=%v", action, decision, err)
		}
	}
}

func TestCachedHumanAllowCannotOutliveIdentityFreshness(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, engine := baseFixture(clock)
	decision, err := service.Authorize(context.Background(), requestFor("project.read"))
	if err != nil || !decision.Allow {
		t.Fatalf("decision=%+v err=%v", decision, err)
	}
	clock.Advance(5*time.Minute + time.Microsecond)
	decision, err = service.Authorize(context.Background(), requestFor("project.read"))
	if err != nil || decision.Allow || decision.Reason != "identity_state_stale" || engine.calls != 1 {
		t.Fatalf("decision=%+v err=%v calls=%d", decision, err, engine.calls)
	}
}

func TestPolicyEngineFailureNeverSynthesizesAllow(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, engine := baseFixture(clock)
	engine.err = errors.New("engine unavailable")
	decision, err := service.Authorize(context.Background(), requestFor("project.read"))
	if err == nil || decision.Allow {
		t.Fatalf("decision=%+v err=%v", decision, err)
	}
}
