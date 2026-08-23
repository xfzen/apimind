package access

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type Clock interface{ Now() time.Time }
type systemClock struct{}

func (systemClock) Now() time.Time { return time.Now().UTC() }

type Store interface {
	BoundaryExists(context.Context, string, string) (bool, error)
	GetAccessState(context.Context, string, string, string) (domain.AccessState, error)
	GetPolicyProjection(context.Context, string, string) (domain.PolicyProjection, bool, error)
	GetSecurityConfig(context.Context, string, string) (domain.SecurityConfig, bool, error)
}
type Engine interface {
	Authorize(context.Context, domain.AuthorizationRequest) (bool, error)
}
type Service struct {
	store  Store
	engine Engine
	cache  *Cache
	clock  Clock
}

func New(store Store, engine Engine, cache *Cache, clock Clock) *Service {
	if clock == nil {
		clock = systemClock{}
	}
	if cache == nil {
		cache = NewCache(clock)
	}
	return &Service{store: store, engine: engine, cache: cache, clock: clock}
}

func (s *Service) Authorize(ctx context.Context, request domain.AuthorizationRequest) (domain.AuthorizationDecision, error) {
	if s == nil || s.store == nil || request.EnterpriseID == "" || request.ApplicationInstanceID == "" || request.PrincipalID == "" || request.Action == "" {
		return domain.AuthorizationDecision{}, fmt.Errorf("authorization_boundary_invalid")
	}
	exists, err := s.store.BoundaryExists(ctx, request.EnterpriseID, request.ApplicationInstanceID)
	if err != nil {
		return domain.AuthorizationDecision{}, err
	}
	if !exists {
		return deny("boundary_mismatch", domain.AccessState{}, domain.PolicyProjection{}, 0, request), nil
	}
	state, err := s.store.GetAccessState(ctx, request.EnterpriseID, request.PrincipalID, request.IdentityProvider)
	if err != nil {
		return domain.AuthorizationDecision{}, err
	}
	switch state.LifecycleState {
	case "blocked":
		return deny("principal_blocked", state, domain.PolicyProjection{}, 0, request), nil
	case "pending_external_sync":
		return deny("principal_pending_external_sync", state, domain.PolicyProjection{}, 0, request), nil
	}
	if request.PrincipalKind == "human" && (state.IdentityFreshnessDeadline.IsZero() || !s.clock.Now().Before(state.IdentityFreshnessDeadline)) {
		return deny("identity_state_stale", state, domain.PolicyProjection{}, 0, request), nil
	}
	if request.SessionRevoked {
		return deny("session_revoked", state, domain.PolicyProjection{}, 0, request), nil
	}
	projection, found, err := s.store.GetPolicyProjection(ctx, request.EnterpriseID, request.ApplicationInstanceID)
	if err != nil {
		return domain.AuthorizationDecision{}, err
	}
	if !found || projection.ReconciliationState != "in_sync" {
		return deny("policy_drift", state, projection, 0, request), nil
	}
	config, _, err := s.store.GetSecurityConfig(ctx, request.EnterpriseID, request.ApplicationInstanceID)
	if err != nil {
		return domain.AuthorizationDecision{}, err
	}
	if reason := securityDenial(config, request.Action); reason != "" {
		return deny(reason, state, projection, config.Version, request), nil
	}
	key := cacheKey(request, state, projection, config.Version)
	if value, ok := s.cache.Get(key); ok {
		return value, nil
	}
	if s.engine == nil {
		return domain.AuthorizationDecision{}, fmt.Errorf("policy_engine_unavailable")
	}
	allowed, err := s.engine.Authorize(ctx, request)
	if err != nil {
		return domain.AuthorizationDecision{}, err
	}
	decision := deny("policy_denied", state, projection, config.Version, request)
	if allowed {
		decision.Allow = true
		decision.Reason = "allowed"
	}
	expires := s.clock.Now().Add(time.Minute)
	if request.PrincipalKind == "human" && state.IdentityFreshnessDeadline.Before(expires) {
		expires = state.IdentityFreshnessDeadline
	}
	s.cache.Put(key, decision, expires)
	return decision, nil
}
func (s *Service) BatchAuthorize(ctx context.Context, requests []domain.AuthorizationRequest) ([]domain.AuthorizationDecision, error) {
	values := make([]domain.AuthorizationDecision, len(requests))
	var first error
	for index, request := range requests {
		decision, err := s.Authorize(ctx, request)
		values[index] = decision
		if err != nil && first == nil {
			first = err
		}
	}
	return values, first
}
func deny(reason string, state domain.AccessState, projection domain.PolicyProjection, configVersion uint64, request domain.AuthorizationRequest) domain.AuthorizationDecision {
	return domain.AuthorizationDecision{Reason: reason, LifecycleVersion: state.LifecycleVersion, IdentitySyncVersion: state.IdentitySyncVersion, IdentityFreshnessDeadline: state.IdentityFreshnessDeadline, PolicyVersion: projection.PolicyVersion, AuthorizedResourceVersion: request.ResourceVersion, SecurityConfigVersion: configVersion}
}
func securityDenial(config domain.SecurityConfig, action string) string {
	if strings.Contains(action, "public_share") && !config.PublicSharing {
		return "public_sharing_disabled"
	}
	if strings.Contains(action, "export") && !config.ExportEnabled {
		return "export_disabled"
	}
	if strings.Contains(action, "secret") && !config.SecretExport {
		return "secret_export_disabled"
	}
	return ""
}
