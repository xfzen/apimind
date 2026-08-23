package credential

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type Store interface {
	Create(context.Context, domain.ServiceCredential) error
	Get(context.Context, string) (domain.ServiceCredential, bool, error)
	Update(context.Context, domain.ServiceCredential) error
	ListUsage(context.Context, string, string) ([]domain.ServiceCredential, error)
}
type Clock interface{ Now() time.Time }
type realClock struct{}

func (realClock) Now() time.Time { return time.Now().UTC() }

type Config struct {
	Clock                            Clock
	RotationOverlap, MaximumLifetime time.Duration
}
type Service struct {
	store                            Store
	clock                            Clock
	rotationOverlap, maximumLifetime time.Duration
}

func New(store Store, config Config) *Service {
	if config.Clock == nil {
		config.Clock = realClock{}
	}
	if config.RotationOverlap <= 0 {
		config.RotationOverlap = 5 * time.Minute
	}
	if config.MaximumLifetime <= 0 {
		config.MaximumLifetime = 365 * 24 * time.Hour
	}
	return &Service{store: store, clock: config.Clock, rotationOverlap: config.RotationOverlap, maximumLifetime: config.MaximumLifetime}
}

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
func (e *DecisionError) Unwrap() error        { return e.Err }
func decision(reason string, err error) error { return &DecisionError{Reason: reason, Err: err} }

type CreateInput struct {
	EnterpriseID, ApplicationID, ApplicationInstanceID, Name string
	Scopes                                                   []domain.CredentialScope
	Lifetime                                                 time.Duration
}
type Created struct {
	ID, Secret, EnterpriseID, ApplicationID, ApplicationInstanceID, Name, RotationLineage string
	ExpiresAt                                                                             time.Time
	Scopes                                                                                []domain.CredentialScope
}
type AccessRequest struct {
	EnterpriseID, ApplicationID, ApplicationInstanceID, ResourceType, ResourceID, Action string
	DelegatedUserOperation                                                               bool
}
type Principal struct {
	CredentialID, EnterpriseID, ApplicationID, ApplicationInstanceID string
	Scopes                                                           []domain.CredentialScope
}

func (s *Service) Create(ctx context.Context, input CreateInput) (Created, error) {
	return s.create(ctx, input, "", "")
}
func (s *Service) create(ctx context.Context, input CreateInput, lineage, rotatedFrom string) (Created, error) {
	if s == nil || s.store == nil || input.EnterpriseID == "" || input.ApplicationID == "" || input.ApplicationInstanceID == "" || strings.TrimSpace(input.Name) == "" || len(input.Scopes) == 0 {
		return Created{}, decision("credential_invalid", nil)
	}
	if input.Lifetime <= 0 || input.Lifetime > s.maximumLifetime {
		return Created{}, decision("credential_lifetime_invalid", nil)
	}
	for _, scope := range input.Scopes {
		if scope.ResourceType == "" || scope.ResourceID == "" || len(scope.Actions) == 0 {
			return Created{}, decision("credential_scope_invalid", nil)
		}
	}
	id := randomID("cred_")
	if lineage == "" {
		lineage = id
	}
	secretPart := randomSecret()
	raw := id + "." + secretPart
	digest := sha256.Sum256([]byte(raw))
	scopes, _ := json.Marshal(input.Scopes)
	now := s.clock.Now().UTC()
	value := domain.ServiceCredential{Base: domain.Base{ID: id, EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, ApplicationID: input.ApplicationID, ApplicationInstanceID: input.ApplicationInstanceID, Name: strings.TrimSpace(input.Name), SecretDigest: hex.EncodeToString(digest[:]), ScopesJSON: scopes, Status: "active", RotationLineage: lineage, RotatedFromID: rotatedFrom, ExpiresAt: now.Add(input.Lifetime), Version: 1}
	if err := s.store.Create(ctx, value); err != nil {
		return Created{}, decision("credential_store_error", err)
	}
	return Created{ID: id, Secret: raw, EnterpriseID: input.EnterpriseID, ApplicationID: input.ApplicationID, ApplicationInstanceID: input.ApplicationInstanceID, Name: strings.TrimSpace(input.Name), RotationLineage: lineage, ExpiresAt: value.ExpiresAt, Scopes: append([]domain.CredentialScope(nil), input.Scopes...)}, nil
}

func (s *Service) Rotate(ctx context.Context, id string, lifetime time.Duration) (Created, error) {
	value, found, err := s.store.Get(ctx, id)
	if err != nil {
		return Created{}, decision("credential_store_error", err)
	}
	if !found || value.Status != "active" {
		return Created{}, decision("credential_inactive", nil)
	}
	var scopes []domain.CredentialScope
	if err := json.Unmarshal(value.ScopesJSON, &scopes); err != nil {
		return Created{}, decision("credential_scope_invalid", err)
	}
	now := s.clock.Now().UTC()
	overlap := now.Add(s.rotationOverlap)
	value.Status = "rotating"
	value.OverlapUntil = &overlap
	value.UpdatedAt = now
	value.Version++
	if err := s.store.Update(ctx, value); err != nil {
		return Created{}, decision("credential_store_error", err)
	}
	return s.create(ctx, CreateInput{EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, ApplicationInstanceID: value.ApplicationInstanceID, Name: value.Name, Scopes: scopes, Lifetime: lifetime}, value.RotationLineage, value.ID)
}

func (s *Service) Revoke(ctx context.Context, id string) error {
	value, found, err := s.store.Get(ctx, id)
	if err != nil {
		return decision("credential_store_error", err)
	}
	if !found {
		return decision("credential_not_found", nil)
	}
	now := s.clock.Now().UTC()
	value.Status = "revoked"
	value.RevokedAt = &now
	value.UpdatedAt = now
	value.Version++
	if err := s.store.Update(ctx, value); err != nil {
		return decision("credential_store_error", err)
	}
	return nil
}

func (s *Service) Authenticate(ctx context.Context, raw string, request AccessRequest) (Principal, error) {
	id, _, found := strings.Cut(raw, ".")
	if !found || id == "" {
		return Principal{}, decision("credential_invalid", nil)
	}
	value, found, err := s.store.Get(ctx, id)
	if err != nil {
		return Principal{}, decision("credential_store_error", err)
	}
	if !found {
		return Principal{}, decision("credential_invalid", nil)
	}
	now := s.clock.Now().UTC()
	active := value.Status == "active" || (value.Status == "rotating" && value.OverlapUntil != nil && now.Before(*value.OverlapUntil))
	if !active || !now.Before(value.ExpiresAt) || value.RevokedAt != nil {
		return Principal{}, decision("credential_inactive", nil)
	}
	digest := sha256.Sum256([]byte(raw))
	want, err := hex.DecodeString(value.SecretDigest)
	if err != nil || subtle.ConstantTimeCompare(want, digest[:]) != 1 {
		return Principal{}, decision("credential_invalid", nil)
	}
	var scopes []domain.CredentialScope
	if err := json.Unmarshal(value.ScopesJSON, &scopes); err != nil {
		return Principal{}, decision("credential_scope_invalid", err)
	}
	if request.DelegatedUserOperation || request.EnterpriseID != value.EnterpriseID || request.ApplicationID != value.ApplicationID || request.ApplicationInstanceID != value.ApplicationInstanceID || !scopeAllows(scopes, request) {
		return Principal{}, decision("credential_scope_denied", nil)
	}
	value.LastUsedAt = &now
	value.UpdatedAt = now
	if err := s.store.Update(ctx, value); err != nil {
		return Principal{}, decision("credential_store_error", err)
	}
	return Principal{CredentialID: value.ID, EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, ApplicationInstanceID: value.ApplicationInstanceID, Scopes: scopes}, nil
}
func (s *Service) ListUsage(ctx context.Context, enterpriseID, instanceID string) ([]domain.ServiceCredential, error) {
	return s.store.ListUsage(ctx, enterpriseID, instanceID)
}
func scopeAllows(scopes []domain.CredentialScope, request AccessRequest) bool {
	for _, scope := range scopes {
		if scope.ResourceType != request.ResourceType || (scope.ResourceID != "*" && scope.ResourceID != request.ResourceID) {
			continue
		}
		for _, action := range scope.Actions {
			if action == request.Action {
				return true
			}
		}
	}
	return false
}
func randomID(prefix string) string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return prefix + hex.EncodeToString(value)
}
func randomSecret() string {
	value := make([]byte, 32)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(value)
}
func reason(err error) string {
	var value *DecisionError
	if errors.As(err, &value) {
		return value.Reason
	}
	return ""
}
