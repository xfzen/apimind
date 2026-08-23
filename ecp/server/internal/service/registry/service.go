package registry

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	manifestcontract "github.com/xfzen/ecp/server/internal/manifest"
)

var machineIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,63}$`)

type Store interface {
	CountEnterprises(context.Context) (int64, error)
	CreateEnterprise(context.Context, domain.Enterprise) error
	GetEnterprise(context.Context, string) (domain.Enterprise, bool, error)
	GetApplication(context.Context, string, string) (domain.Application, bool, error)
	CreateApplication(context.Context, domain.Application) error
	GetInstance(context.Context, string, string) (domain.ApplicationInstance, bool, error)
	CreateInstance(context.Context, domain.ApplicationInstance) error
	PutManifest(context.Context, domain.ProductManifest) (domain.ProductManifest, error)
	CreateConnector(context.Context, domain.Connector) error
}

type ManifestProjector interface {
	ReconcileApplicationManifest(context.Context, string, string) error
}

type Service struct {
	store     Store
	manifests ManifestProjector
}

func New(store Store) *Service { return &Service{store: store} }

func (s *Service) SetManifestProjector(projector ManifestProjector) {
	if s != nil {
		s.manifests = projector
	}
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

type RegisterEnterpriseInput struct{ ID, Name string }
type RegisterApplicationInput struct{ ID, EnterpriseID, Key, Name string }
type RegisterInstanceInput struct{ EnterpriseID, ApplicationID, InstanceKey, Environment, CanonicalURL string }
type PutManifestInput struct {
	EnterpriseID, ApplicationID, APIVersion string
	Body                                    []byte
}
type RegisterConnectorInput struct{ EnterpriseID, ApplicationID, InstanceID, ConnectorKey string }
type ConnectorCredential struct{ EnterpriseID, InstanceID string }

func (s *Service) RegisterEnterprise(ctx context.Context, input RegisterEnterpriseInput) (domain.Enterprise, error) {
	if s == nil || s.store == nil {
		return domain.Enterprise{}, decision("registry_unavailable", nil)
	}
	if !validID(input.ID) || strings.TrimSpace(input.Name) == "" {
		return domain.Enterprise{}, decision("invalid_enterprise", nil)
	}
	count, err := s.store.CountEnterprises(ctx)
	if err != nil {
		return domain.Enterprise{}, decision("registry_store_error", err)
	}
	if count > 0 {
		return domain.Enterprise{}, decision("single_enterprise_violation", nil)
	}
	now := time.Now().UTC()
	value := domain.Enterprise{Base: domain.Base{ID: input.ID, EnterpriseID: input.ID, CreatedAt: now, UpdatedAt: now}, Name: strings.TrimSpace(input.Name), Status: "active"}
	if err := s.store.CreateEnterprise(ctx, value); err != nil {
		return domain.Enterprise{}, decision("registry_store_error", err)
	}
	return value, nil
}

func (s *Service) RegisterApplication(ctx context.Context, input RegisterApplicationInput) (domain.Application, error) {
	if s == nil || s.store == nil {
		return domain.Application{}, decision("registry_unavailable", nil)
	}
	if !validID(input.ID) || !validID(input.EnterpriseID) || !validID(input.Key) || strings.TrimSpace(input.Name) == "" {
		return domain.Application{}, decision("invalid_application", nil)
	}
	if _, found, err := s.store.GetEnterprise(ctx, input.EnterpriseID); err != nil {
		return domain.Application{}, decision("registry_store_error", err)
	} else if !found {
		return domain.Application{}, decision("enterprise_not_found", nil)
	}
	now := time.Now().UTC()
	value := domain.Application{Base: domain.Base{ID: input.ID, EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, Key: input.Key, Name: strings.TrimSpace(input.Name), Status: "active", Version: 1}
	if err := s.store.CreateApplication(ctx, value); err != nil {
		return domain.Application{}, decision("registry_store_error", err)
	}
	return value, nil
}

func (s *Service) RegisterInstance(ctx context.Context, input RegisterInstanceInput) (domain.ApplicationInstance, error) {
	if s == nil || s.store == nil {
		return domain.ApplicationInstance{}, decision("registry_unavailable", nil)
	}
	application, found, err := s.store.GetApplication(ctx, input.EnterpriseID, input.ApplicationID)
	if err != nil {
		return domain.ApplicationInstance{}, decision("registry_store_error", err)
	}
	if !found {
		return domain.ApplicationInstance{}, decision("application_not_found", nil)
	}
	if !validID(input.InstanceKey) || application.EnterpriseID != input.EnterpriseID {
		return domain.ApplicationInstance{}, decision("invalid_instance", nil)
	}
	canonicalURL, err := validateCanonicalURL(input.CanonicalURL)
	if err != nil {
		return domain.ApplicationInstance{}, decision("invalid_canonical_url", err)
	}
	environment := strings.TrimSpace(input.Environment)
	if environment == "" {
		environment = "production"
	}
	now := time.Now().UTC()
	value := domain.ApplicationInstance{Base: domain.Base{ID: newID("ins"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, ApplicationID: input.ApplicationID, InstanceKey: input.InstanceKey, Environment: environment, CanonicalURL: canonicalURL, Status: "active", Version: 1}
	if err := s.store.CreateInstance(ctx, value); err != nil {
		return domain.ApplicationInstance{}, decision("registry_store_error", err)
	}
	return value, nil
}

func (s *Service) PutManifest(ctx context.Context, input PutManifestInput) (domain.ProductManifest, error) {
	if s == nil || s.store == nil {
		return domain.ProductManifest{}, decision("registry_unavailable", nil)
	}
	if _, found, err := s.store.GetApplication(ctx, input.EnterpriseID, input.ApplicationID); err != nil {
		return domain.ProductManifest{}, decision("registry_store_error", err)
	} else if !found {
		return domain.ProductManifest{}, decision("application_not_found", nil)
	}
	if input.APIVersion != "connector.manifest/v1" && input.APIVersion != "connector.manifest/v0" {
		return domain.ProductManifest{}, decision("manifest_version_incompatible", nil)
	}
	var body map[string]any
	if err := json.Unmarshal(input.Body, &body); err != nil {
		return domain.ProductManifest{}, decision("manifest_invalid", err)
	}
	if schema, _ := body["schema_version"].(string); schema != input.APIVersion {
		return domain.ProductManifest{}, decision("manifest_version_mismatch", nil)
	}
	if input.APIVersion == "connector.manifest/v1" {
		if _, err := manifestcontract.Parse(input.Body); err != nil {
			return domain.ProductManifest{}, decision("manifest_invalid", err)
		}
	}
	hash := sha256.Sum256(input.Body)
	now := time.Now().UTC()
	value := domain.ProductManifest{Base: domain.Base{ID: newID("man"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, ApplicationID: input.ApplicationID, APIVersion: input.APIVersion, ManifestHash: hex.EncodeToString(hash[:]), Body: append([]byte(nil), input.Body...), Version: 1}
	persisted, err := s.store.PutManifest(ctx, value)
	if err != nil {
		return domain.ProductManifest{}, decision("registry_store_error", err)
	}
	if s.manifests != nil {
		if err := s.manifests.ReconcileApplicationManifest(ctx, input.EnterpriseID, input.ApplicationID); err != nil {
			return domain.ProductManifest{}, decision("manifest_projection_error", err)
		}
	}
	return persisted, nil
}

func (s *Service) RegisterConnector(ctx context.Context, input RegisterConnectorInput) (domain.Connector, error) {
	if s == nil || s.store == nil {
		return domain.Connector{}, decision("registry_unavailable", nil)
	}
	instance, found, err := s.store.GetInstance(ctx, input.EnterpriseID, input.InstanceID)
	if err != nil {
		return domain.Connector{}, decision("registry_store_error", err)
	}
	if !found || instance.ApplicationID != input.ApplicationID {
		return domain.Connector{}, decision("instance_not_found", nil)
	}
	if !validID(input.ConnectorKey) {
		return domain.Connector{}, decision("invalid_connector", nil)
	}
	now := time.Now().UTC()
	value := domain.Connector{Base: domain.Base{ID: newID("con"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, ApplicationID: input.ApplicationID, InstanceID: input.InstanceID, ConnectorKey: input.ConnectorKey, Status: "active", Version: 1}
	if err := s.store.CreateConnector(ctx, value); err != nil {
		return domain.Connector{}, decision("registry_store_error", err)
	}
	return value, nil
}

func (s *Service) AssertConnectorScope(_ context.Context, credential ConnectorCredential, instanceID string) error {
	if credential.InstanceID == "" || credential.InstanceID != instanceID {
		return decision("connector_scope_mismatch", nil)
	}
	return nil
}

func validID(value string) bool { return machineIDPattern.MatchString(value) }

func validateCanonicalURL(value string) (string, error) {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("canonical URL must be absolute HTTPS without credentials, query, or fragment")
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	return parsed.String(), nil
}

func newID(prefix string) string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}
	return prefix + "_" + hex.EncodeToString(buffer)
}

func decision(reason string, err error) error { return &DecisionError{Reason: reason, Err: err} }
