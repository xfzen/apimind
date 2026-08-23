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
	last  domain.AuthorizationRequest
}

func (e *fakeEngine) Authorize(_ context.Context, request domain.AuthorizationRequest) (bool, error) {
	e.calls++
	e.last = request
	return e.allow, e.err
}

type fakeStore struct {
	boundary   bool
	identity   domain.AuthorizationIdentity
	state      domain.AccessState
	projection domain.PolicyProjection
	config     domain.SecurityConfig
	err        error
}

func (s fakeStore) BoundaryExists(context.Context, string, string) (bool, error) {
	return s.boundary, s.err
}
func (s fakeStore) GetAuthorizationIdentity(context.Context, string, string) (domain.AuthorizationIdentity, bool, error) {
	return s.identity, s.identity.PolicySubject != "", s.err
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
	store := fakeStore{boundary: true, identity: domain.AuthorizationIdentity{PrincipalKind: "human", IdentityProvider: "casdoor", PolicySubject: "principal-1", DirectGroupVersion: 1}, state: domain.AccessState{LifecycleState: "active", LifecycleVersion: 1, IdentitySyncVersion: 1, IdentityFreshnessDeadline: clock.Now().Add(5 * time.Minute)}, projection: domain.PolicyProjection{Base: domain.Base{ID: "pol-1", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", CasdoorPermissionID: "acme/apimind-ins-1", PolicyVersion: 1, ReconciliationState: "in_sync"}, config: domain.SecurityConfig{Base: domain.Base{ID: "sec-1", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", Version: 1}}
	return New(store, engine, NewCache(clock), clock), engine
}

func requestFor(action string) domain.AuthorizationRequest {
	return domain.AuthorizationRequest{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", PrincipalID: "principal-1", PrincipalKind: "human", IdentityProvider: "casdoor", Action: action, ResourceType: "project", ResourceID: "project-1", ResourceVersion: 1, DirectGroupVersion: 1}
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

func TestRevokedServiceCredentialOverridesPolicyAllow(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, engine := baseFixture(clock)
	store := service.store.(fakeStore)
	store.identity = domain.AuthorizationIdentity{PrincipalKind: "service", IdentityProvider: "service_credential", PolicySubject: "cred-1"}
	store.state.LifecycleState = "blocked"
	service.store = store
	decision, err := service.Authorize(context.Background(), domain.AuthorizationRequest{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", PrincipalID: "cred-1", Action: "project.read", ResourceType: "project", ResourceID: "project-1", ResourceVersion: 1})
	if err != nil {
		t.Fatal(err)
	}
	if decision.Allow || decision.Reason != "credential_revoked" || engine.calls != 0 {
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

func TestAuthorizationIdentityIsLoadedByECPNotTrustedFromConnector(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, engine := baseFixture(clock)
	request := requestFor("project.read")
	request.PolicySubject = "attacker"
	request.DirectGroupIDs = []string{"admin"}
	request.DirectGroupVersion = 999
	decision, err := service.Authorize(context.Background(), request)
	if err != nil || !decision.Allow {
		t.Fatalf("decision=%+v err=%v", decision, err)
	}
	if engine.last.PolicySubject != "principal-1" || engine.last.DirectGroupVersion != 1 || len(engine.last.DirectGroupIDs) != 0 {
		t.Fatalf("engine request trusted connector identity: %+v", engine.last)
	}
}

func TestCasdoorPermissionBindingIsLoadedByECPNotTrustedFromConnector(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, engine := baseFixture(clock)
	request := requestFor("project.read")
	request.PermissionID = "attacker/admin"
	decision, err := service.Authorize(context.Background(), request)
	if err != nil || !decision.Allow {
		t.Fatalf("decision=%+v err=%v", decision, err)
	}
	if engine.last.PermissionID != "acme/apimind-ins-1" {
		t.Fatalf("engine trusted connector permission binding: %+v", engine.last)
	}
}

func TestMissingCasdoorPermissionBindingFailsClosed(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, engine := baseFixture(clock)
	store := service.store.(fakeStore)
	store.projection.CasdoorPermissionID = ""
	service.store = store
	decision, err := service.Authorize(context.Background(), requestFor("project.read"))
	if err != nil || decision.Allow || decision.Reason != "policy_binding_missing" || engine.calls != 0 {
		t.Fatalf("decision=%+v err=%v calls=%d", decision, err, engine.calls)
	}
}

func TestDelegationStateRequiresFreshIdentityAndInSyncPolicyWithoutResourceDecision(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)}
	service, engine := baseFixture(clock)
	state, err := service.DelegationState(context.Background(), "ent-1", "ins-1", "principal-1")
	if err != nil {
		t.Fatal(err)
	}
	if state.PolicyVersion != 1 || state.LifecycleVersion != 1 || state.IdentitySyncVersion != 1 || !state.IdentityFreshnessDeadline.Equal(clock.Now().Add(5*time.Minute)) || engine.calls != 0 {
		t.Fatalf("state=%+v engine calls=%d", state, engine.calls)
	}
	clock.Advance(5*time.Minute + time.Microsecond)
	if _, err := service.DelegationState(context.Background(), "ent-1", "ins-1", "principal-1"); err == nil {
		t.Fatal("expected stale identity rejection")
	}
}
