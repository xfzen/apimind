package oidcclient

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type Store interface {
	Create(context.Context, domain.OIDCClient) error
	Get(context.Context, string, string) (domain.OIDCClient, bool, error)
	GetByInstance(context.Context, string, string) (domain.OIDCClient, bool, error)
	Update(context.Context, domain.OIDCClient) error
	InstanceBelongsTo(context.Context, string, string, string) (bool, error)
}

type Service struct {
	store     Store
	localMode bool
}

func New(store Store, localMode bool) *Service { return &Service{store: store, localMode: localMode} }

type RegisterInput struct {
	EnterpriseID, ApplicationID, InstanceID, ClientID, SecretReference string
	RedirectURIs                                                       []string
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
func (e *DecisionError) Unwrap() error { return e.Err }

func AsDecision(err error, target **DecisionError) bool { return errors.As(err, target) }

func (s *Service) Register(ctx context.Context, input RegisterInput) (domain.OIDCClient, error) {
	if s == nil || s.store == nil {
		return domain.OIDCClient{}, decision("oidc_client_store_unavailable", nil)
	}
	if input.EnterpriseID == "" || input.ApplicationID == "" || input.InstanceID == "" || input.ClientID == "" || !validSecretReference(input.SecretReference) || len(input.RedirectURIs) == 0 {
		return domain.OIDCClient{}, decision("oidc_client_invalid", nil)
	}
	belongs, err := s.store.InstanceBelongsTo(ctx, input.EnterpriseID, input.ApplicationID, input.InstanceID)
	if err != nil {
		return domain.OIDCClient{}, decision("oidc_client_store_error", err)
	}
	if !belongs {
		return domain.OIDCClient{}, decision("oidc_client_instance_mismatch", nil)
	}
	redirects := make([]string, 0, len(input.RedirectURIs))
	seen := make(map[string]struct{}, len(input.RedirectURIs))
	for _, redirect := range input.RedirectURIs {
		normalized, err := validateRedirectURI(redirect, s.localMode)
		if err != nil {
			return domain.OIDCClient{}, decision("redirect_uri_invalid", err)
		}
		if _, exists := seen[normalized]; !exists {
			redirects = append(redirects, normalized)
			seen[normalized] = struct{}{}
		}
	}
	now := time.Now().UTC()
	value := domain.OIDCClient{
		Base:          domain.Base{ID: newID("odc"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now},
		ApplicationID: input.ApplicationID, InstanceID: input.InstanceID, ClientID: input.ClientID,
		SecretReference: input.SecretReference, RedirectURIs: redirects, Status: "active", Version: 1,
	}
	if err := s.store.Create(ctx, value); err != nil {
		return domain.OIDCClient{}, decision("oidc_client_store_error", err)
	}
	return value, nil
}

func (s *Service) Get(ctx context.Context, enterpriseID, id string) (domain.OIDCClient, error) {
	if s == nil || s.store == nil {
		return domain.OIDCClient{}, decision("oidc_client_store_unavailable", nil)
	}
	value, found, err := s.store.Get(ctx, enterpriseID, id)
	if err != nil {
		return domain.OIDCClient{}, decision("oidc_client_store_error", err)
	}
	if !found {
		return domain.OIDCClient{}, decision("oidc_client_not_found", nil)
	}
	return value, nil
}

func (s *Service) GetByInstance(ctx context.Context, enterpriseID, instanceID string) (domain.OIDCClient, error) {
	if s == nil || s.store == nil {
		return domain.OIDCClient{}, decision("oidc_client_store_unavailable", nil)
	}
	value, found, err := s.store.GetByInstance(ctx, enterpriseID, instanceID)
	if err != nil {
		return domain.OIDCClient{}, decision("oidc_client_store_error", err)
	}
	if !found {
		return domain.OIDCClient{}, decision("oidc_client_not_found", nil)
	}
	return value, nil
}

func (s *Service) RotateSecret(ctx context.Context, enterpriseID, id, secretReference string) (domain.OIDCClient, error) {
	if s == nil || s.store == nil {
		return domain.OIDCClient{}, decision("oidc_client_store_unavailable", nil)
	}
	if !validSecretReference(secretReference) {
		return domain.OIDCClient{}, decision("secret_reference_invalid", nil)
	}
	value, found, err := s.store.Get(ctx, enterpriseID, id)
	if err != nil {
		return domain.OIDCClient{}, decision("oidc_client_store_error", err)
	}
	if !found {
		return domain.OIDCClient{}, decision("oidc_client_not_found", nil)
	}
	value.SecretReference = secretReference
	value.Version++
	value.UpdatedAt = time.Now().UTC()
	if err := s.store.Update(ctx, value); err != nil {
		return domain.OIDCClient{}, decision("oidc_client_store_error", err)
	}
	return value, nil
}

func (s *Service) Disable(ctx context.Context, enterpriseID, id string) (domain.OIDCClient, error) {
	if s == nil || s.store == nil {
		return domain.OIDCClient{}, decision("oidc_client_store_unavailable", nil)
	}
	value, found, err := s.store.Get(ctx, enterpriseID, id)
	if err != nil {
		return domain.OIDCClient{}, decision("oidc_client_store_error", err)
	}
	if !found {
		return domain.OIDCClient{}, decision("oidc_client_not_found", nil)
	}
	now := time.Now().UTC()
	value.Status, value.DisabledAt, value.UpdatedAt = "disabled", &now, now
	value.Version++
	if err := s.store.Update(ctx, value); err != nil {
		return domain.OIDCClient{}, decision("oidc_client_store_error", err)
	}
	return value, nil
}

func (s *Service) ValidateRedirect(allowed []string, requested string) error {
	normalized, err := validateRedirectURI(requested, s.localMode)
	if err != nil {
		return decision("redirect_uri_invalid", err)
	}
	for _, candidate := range allowed {
		if candidate == normalized {
			return nil
		}
	}
	return decision("redirect_uri_mismatch", nil)
}

func validateRedirectURI(raw string, localMode bool) (string, error) {
	if strings.Contains(raw, "*") {
		return "", fmt.Errorf("wildcards are forbidden")
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" || parsed.RawQuery != "" {
		return "", fmt.Errorf("redirect must be an absolute URI without credentials, query, or fragment")
	}
	if parsed.Scheme != "https" {
		if !localMode || parsed.Scheme != "http" || !isLoopback(parsed.Hostname()) {
			return "", fmt.Errorf("redirect must use HTTPS")
		}
	}
	return parsed.String(), nil
}

func validSecretReference(value string) bool {
	parsed, err := url.Parse(value)
	return err == nil && parsed.Scheme != "" && parsed.Scheme != "http" && parsed.Scheme != "https" && !strings.ContainsAny(value, "\r\n")
}

func isLoopback(host string) bool { return host == "localhost" || host == "127.0.0.1" || host == "::1" }

func newID(prefix string) string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}
	return prefix + "_" + hex.EncodeToString(buffer)
}

func decision(reason string, err error) error { return &DecisionError{Reason: reason, Err: err} }
