package lifecycle

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

const (
	HumanPrincipal   = "human"
	MachinePrincipal = "machine"
)

type Clock interface{ Now() time.Time }
type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now().UTC() }

type Store interface {
	GetLifecycle(context.Context, string, string) (domain.PrincipalLifecycle, bool, error)
	PutLifecycle(context.Context, domain.PrincipalLifecycle) error
	GetSyncState(context.Context, string, string) (domain.IdentitySyncState, bool, error)
	PutSyncState(context.Context, domain.IdentitySyncState) error
}

type Service struct {
	store        Store
	clock        Clock
	freshnessTTL time.Duration
}

func New(store Store, clock Clock, freshnessTTL time.Duration) *Service {
	if clock == nil {
		clock = systemClock{}
	}
	if freshnessTTL <= 0 {
		freshnessTTL = 5 * time.Minute
	}
	return &Service{store: store, clock: clock, freshnessTTL: freshnessTTL}
}

type Subject struct{ EnterpriseID, PrincipalID, Provider, Kind string }
type DecisionError struct {
	Reason string
	Err    error
}

func (e *DecisionError) Error() string {
	if e.Err == nil {
		return e.Reason
	}
	return fmt.Sprintf("%s: %v", e.Reason, e.Err)
}
func (e *DecisionError) Unwrap() error { return e.Err }

func (s *Service) Block(ctx context.Context, enterpriseID, principalID string) (domain.PrincipalLifecycle, error) {
	return s.setLifecycle(ctx, enterpriseID, principalID, domain.LifecycleBlocked)
}
func (s *Service) MarkPendingExternalSync(ctx context.Context, enterpriseID, principalID string) (domain.PrincipalLifecycle, error) {
	return s.setLifecycle(ctx, enterpriseID, principalID, domain.LifecyclePendingExternalSync)
}

// ObserveAuthentication records a freshly verified OIDC assertion without
// reactivating a principal that was explicitly blocked or awaits directory sync.
func (s *Service) ObserveAuthentication(ctx context.Context, enterpriseID, principalID, provider string) error {
	if s == nil || s.store == nil || enterpriseID == "" || principalID == "" || provider == "" {
		return decision("lifecycle_unavailable", nil)
	}
	value, found, err := s.store.GetLifecycle(ctx, enterpriseID, principalID)
	if err != nil {
		return decision("lifecycle_store_error", err)
	}
	if found {
		switch value.State {
		case domain.LifecycleBlocked:
			return decision("principal_blocked", nil)
		case domain.LifecyclePendingExternalSync:
			return decision("principal_pending_external_sync", nil)
		case domain.LifecycleActive:
		default:
			return decision("principal_lifecycle_invalid", nil)
		}
	} else if _, err := s.setLifecycle(ctx, enterpriseID, principalID, domain.LifecycleActive); err != nil {
		return err
	}
	_, err = s.MarkSyncSuccess(ctx, enterpriseID, provider, "oidc")
	return err
}

func (s *Service) setLifecycle(ctx context.Context, enterpriseID, principalID, state string) (domain.PrincipalLifecycle, error) {
	if s == nil || s.store == nil || enterpriseID == "" || principalID == "" {
		return domain.PrincipalLifecycle{}, decision("lifecycle_unavailable", nil)
	}
	value, found, err := s.store.GetLifecycle(ctx, enterpriseID, principalID)
	if err != nil {
		return domain.PrincipalLifecycle{}, decision("lifecycle_store_error", err)
	}
	now := s.clock.Now().UTC()
	if !found {
		value = domain.PrincipalLifecycle{Base: domain.Base{ID: newID("lif"), EnterpriseID: enterpriseID, CreatedAt: now}, PrincipalID: principalID, Version: 0}
	}
	value.State, value.UpdatedAt = state, now
	value.Version++
	if state == domain.LifecycleBlocked {
		value.BlockedAt = &now
	}
	if err := s.store.PutLifecycle(ctx, value); err != nil {
		return domain.PrincipalLifecycle{}, decision("lifecycle_store_error", err)
	}
	return value, nil
}

func (s *Service) MarkSyncSuccess(ctx context.Context, enterpriseID, provider, cursor string) (domain.IdentitySyncState, error) {
	return s.putSync(ctx, enterpriseID, provider, cursor, "fresh", "")
}
func (s *Service) MarkSyncFailure(ctx context.Context, enterpriseID, provider string, cause error) (domain.IdentitySyncState, error) {
	message := "sync failed"
	if cause != nil {
		message = cause.Error()
	}
	return s.putSync(ctx, enterpriseID, provider, "", "stale", message)
}
func (s *Service) putSync(ctx context.Context, enterpriseID, provider, cursor, state, lastError string) (domain.IdentitySyncState, error) {
	if s == nil || s.store == nil || enterpriseID == "" || provider == "" {
		return domain.IdentitySyncState{}, decision("lifecycle_unavailable", nil)
	}
	value, found, err := s.store.GetSyncState(ctx, enterpriseID, provider)
	if err != nil {
		return domain.IdentitySyncState{}, decision("lifecycle_store_error", err)
	}
	now := s.clock.Now().UTC()
	if !found {
		value = domain.IdentitySyncState{Base: domain.Base{ID: newID("syn"), EnterpriseID: enterpriseID, CreatedAt: now}, Provider: provider}
	}
	value.Version++
	value.State, value.LastError, value.UpdatedAt = state, lastError, now
	if state == "fresh" {
		deadline := now.Add(s.freshnessTTL)
		value.LastSuccessfulSync, value.FreshnessDeadline, value.SourceCursor = &now, &deadline, cursor
	}
	if err := s.store.PutSyncState(ctx, value); err != nil {
		return domain.IdentitySyncState{}, decision("lifecycle_store_error", err)
	}
	return value, nil
}

func (s *Service) AssertFresh(ctx context.Context, subject Subject) error {
	if s == nil || s.store == nil {
		return decision("lifecycle_unavailable", nil)
	}
	value, found, err := s.store.GetLifecycle(ctx, subject.EnterpriseID, subject.PrincipalID)
	if err != nil {
		return decision("lifecycle_store_error", err)
	}
	if found {
		switch value.State {
		case domain.LifecycleBlocked:
			return decision("principal_blocked", nil)
		case domain.LifecyclePendingExternalSync:
			return decision("principal_pending_external_sync", nil)
		}
	}
	if subject.Kind == MachinePrincipal {
		return nil
	}
	syncState, found, err := s.store.GetSyncState(ctx, subject.EnterpriseID, subject.Provider)
	if err != nil {
		return decision("lifecycle_store_error", err)
	}
	if !found || syncState.State != "fresh" || syncState.FreshnessDeadline == nil || s.clock.Now().After(*syncState.FreshnessDeadline) {
		return decision("identity_state_stale", nil)
	}
	return nil
}

func newID(prefix string) string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}
	return prefix + "_" + hex.EncodeToString(buffer)
}
func decision(reason string, err error) error { return &DecisionError{Reason: reason, Err: err} }
