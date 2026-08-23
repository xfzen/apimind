package lifecycle

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time              { return c.now }
func (c *fakeClock) Advance(value time.Duration) { c.now = c.now.Add(value) }

type memoryLifecycleStore struct {
	lifecycles map[string]domain.PrincipalLifecycle
	syncStates map[string]domain.IdentitySyncState
}

func (s *memoryLifecycleStore) GetLifecycle(_ context.Context, enterpriseID, principalID string) (domain.PrincipalLifecycle, bool, error) {
	value, ok := s.lifecycles[enterpriseID+"/"+principalID]
	return value, ok, nil
}
func (s *memoryLifecycleStore) PutLifecycle(_ context.Context, value domain.PrincipalLifecycle) error {
	if s.lifecycles == nil {
		s.lifecycles = make(map[string]domain.PrincipalLifecycle)
	}
	s.lifecycles[value.EnterpriseID+"/"+value.PrincipalID] = value
	return nil
}
func (s *memoryLifecycleStore) GetSyncState(_ context.Context, enterpriseID, provider string) (domain.IdentitySyncState, bool, error) {
	value, ok := s.syncStates[enterpriseID+"/"+provider]
	return value, ok, nil
}
func (s *memoryLifecycleStore) PutSyncState(_ context.Context, value domain.IdentitySyncState) error {
	if s.syncStates == nil {
		s.syncStates = make(map[string]domain.IdentitySyncState)
	}
	s.syncStates[value.EnterpriseID+"/"+value.Provider] = value
	return nil
}

func TestIdentitySyncExpiresHumanAllow(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)}
	service := New(&memoryLifecycleStore{}, clock, 5*time.Minute)
	if _, err := service.MarkSyncSuccess(context.Background(), "ent-1", "casdoor", "cursor-1"); err != nil {
		t.Fatal(err)
	}
	clock.Advance(5*time.Minute + time.Microsecond)
	err := service.AssertFresh(context.Background(), Subject{EnterpriseID: "ent-1", PrincipalID: "principal-1", Provider: "casdoor", Kind: HumanPrincipal})
	assertLifecycleReason(t, err, "identity_state_stale")
}

func TestBlockedAndPendingPrincipalsDenyImmediately(t *testing.T) {
	clock := &fakeClock{now: time.Date(2026, 8, 23, 0, 0, 0, 0, time.UTC)}
	service := New(&memoryLifecycleStore{}, clock, 5*time.Minute)
	if _, err := service.MarkSyncSuccess(context.Background(), "ent-1", "casdoor", "cursor-1"); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Block(context.Background(), "ent-1", "principal-1"); err != nil {
		t.Fatal(err)
	}
	assertLifecycleReason(t, service.AssertFresh(context.Background(), Subject{EnterpriseID: "ent-1", PrincipalID: "principal-1", Provider: "casdoor", Kind: HumanPrincipal}), "principal_blocked")
	if _, err := service.MarkPendingExternalSync(context.Background(), "ent-1", "principal-2"); err != nil {
		t.Fatal(err)
	}
	assertLifecycleReason(t, service.AssertFresh(context.Background(), Subject{EnterpriseID: "ent-1", PrincipalID: "principal-2", Provider: "casdoor", Kind: HumanPrincipal}), "principal_pending_external_sync")
}

func assertLifecycleReason(t *testing.T, err error, reason string) {
	t.Helper()
	if err == nil || !strings.Contains(err.Error(), reason) {
		t.Fatalf("expected %q, got %v", reason, err)
	}
}
