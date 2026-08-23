package registry

import (
	"context"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

type manifestProjectorFixture struct {
	enterpriseID, applicationID string
	calls                       int
}

func (p *manifestProjectorFixture) ReconcileApplicationManifest(_ context.Context, enterpriseID, applicationID string) error {
	p.enterpriseID, p.applicationID = enterpriseID, applicationID
	p.calls++
	return nil
}

func TestRegisterInstanceRequiresKnownApplication(t *testing.T) {
	store := newMemoryStore()
	svc := New(store)
	if _, err := svc.RegisterEnterprise(context.Background(), RegisterEnterpriseInput{ID: "ent-1", Name: "Acme"}); err != nil {
		t.Fatal(err)
	}
	_, err := svc.RegisterInstance(context.Background(), RegisterInstanceInput{
		EnterpriseID: "ent-1", ApplicationID: "missing", InstanceKey: "prod", CanonicalURL: "https://api.example.com",
	})
	assertReason(t, err, "application_not_found")
}

func TestRegisterInstanceAcceptsStableBootstrapID(t *testing.T) {
	store := newMemoryStore()
	service := New(store)
	ctx := context.Background()
	_, _ = service.RegisterEnterprise(ctx, RegisterEnterpriseInput{ID: "ent-1", Name: "Acme"})
	_, _ = service.RegisterApplication(ctx, RegisterApplicationInput{ID: "app-1", EnterpriseID: "ent-1", Key: "admin", Name: "Admin"})
	instance, err := service.RegisterInstance(ctx, RegisterInstanceInput{ID: "ins-admin", EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceKey: "admin", Environment: "local", CanonicalURL: "https://admin.local"})
	if err != nil {
		t.Fatal(err)
	}
	if instance.ID != "ins-admin" {
		t.Fatalf("instance ID = %q, want stable bootstrap ID", instance.ID)
	}
}

func TestConnectorCannotCrossInstance(t *testing.T) {
	store := newMemoryStore()
	svc := New(store)
	ctx := context.Background()
	_, _ = svc.RegisterEnterprise(ctx, RegisterEnterpriseInput{ID: "ent-1", Name: "Acme"})
	_, _ = svc.RegisterApplication(ctx, RegisterApplicationInput{ID: "app-1", EnterpriseID: "ent-1", Key: "apimind", Name: "ApiMind"})
	instanceA, err := svc.RegisterInstance(ctx, RegisterInstanceInput{EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceKey: "a", CanonicalURL: "https://a.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	instanceB, err := svc.RegisterInstance(ctx, RegisterInstanceInput{EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceKey: "b", CanonicalURL: "https://b.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	credential := ConnectorCredential{EnterpriseID: "ent-1", InstanceID: instanceA.ID}
	err = svc.AssertConnectorScope(ctx, credential, instanceB.ID)
	assertReason(t, err, "connector_scope_mismatch")
}

func TestDeploymentRejectsSecondEnterprise(t *testing.T) {
	svc := New(newMemoryStore())
	ctx := context.Background()
	_, err := svc.RegisterEnterprise(ctx, RegisterEnterpriseInput{ID: "ent-1", Name: "Acme"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.RegisterEnterprise(ctx, RegisterEnterpriseInput{ID: "ent-2", Name: "Other"})
	assertReason(t, err, "single_enterprise_violation")
}

func TestManifestUpdateTriggersRoleProjection(t *testing.T) {
	svc := New(newMemoryStore())
	projector := &manifestProjectorFixture{}
	svc.SetManifestProjector(projector)
	ctx := context.Background()
	_, _ = svc.RegisterEnterprise(ctx, RegisterEnterpriseInput{ID: "ent-1", Name: "Acme"})
	_, _ = svc.RegisterApplication(ctx, RegisterApplicationInput{ID: "app-1", EnterpriseID: "ent-1", Key: "apimind", Name: "ApiMind"})
	body := []byte(`{"schema_version":"connector.manifest/v1","roles":[{"id":"project.viewer","resource_type":"project","actions":["project.read"]}]}`)
	if _, err := svc.PutManifest(ctx, PutManifestInput{EnterpriseID: "ent-1", ApplicationID: "app-1", APIVersion: "connector.manifest/v1", Body: body}); err != nil {
		t.Fatal(err)
	}
	if projector.calls != 1 || projector.enterpriseID != "ent-1" || projector.applicationID != "app-1" {
		t.Fatalf("projector=%+v", projector)
	}
}

func assertReason(t *testing.T, err error, reason string) {
	t.Helper()
	decision, ok := err.(*DecisionError)
	if !ok || decision.Reason != reason {
		t.Fatalf("error=%v, want reason=%s", err, reason)
	}
}

type memoryStore struct {
	enterprises  map[string]domain.Enterprise
	applications map[string]domain.Application
	instances    map[string]domain.ApplicationInstance
	manifests    map[string]domain.ProductManifest
	connectors   map[string]domain.Connector
}

func newMemoryStore() *memoryStore {
	return &memoryStore{
		enterprises: map[string]domain.Enterprise{}, applications: map[string]domain.Application{},
		instances: map[string]domain.ApplicationInstance{}, manifests: map[string]domain.ProductManifest{}, connectors: map[string]domain.Connector{},
	}
}

func (s *memoryStore) CountEnterprises(context.Context) (int64, error) {
	return int64(len(s.enterprises)), nil
}
func (s *memoryStore) CreateEnterprise(_ context.Context, value domain.Enterprise) error {
	s.enterprises[value.ID] = value
	return nil
}
func (s *memoryStore) GetEnterprise(_ context.Context, id string) (domain.Enterprise, bool, error) {
	value, ok := s.enterprises[id]
	return value, ok, nil
}
func (s *memoryStore) GetApplication(_ context.Context, enterpriseID, id string) (domain.Application, bool, error) {
	value, ok := s.applications[id]
	return value, ok && value.EnterpriseID == enterpriseID, nil
}
func (s *memoryStore) CreateApplication(_ context.Context, value domain.Application) error {
	s.applications[value.ID] = value
	return nil
}
func (s *memoryStore) GetInstance(_ context.Context, enterpriseID, id string) (domain.ApplicationInstance, bool, error) {
	value, ok := s.instances[id]
	return value, ok && value.EnterpriseID == enterpriseID, nil
}
func (s *memoryStore) CreateInstance(_ context.Context, value domain.ApplicationInstance) error {
	s.instances[value.ID] = value
	return nil
}

func (s *memoryStore) PutManifest(_ context.Context, value domain.ProductManifest) (domain.ProductManifest, error) {
	if current, exists := s.manifests[value.ApplicationID]; exists {
		value.ID = current.ID
		value.CreatedAt = current.CreatedAt
		value.Version = current.Version + 1
	}
	s.manifests[value.ApplicationID] = value
	return value, nil
}
func (s *memoryStore) CreateConnector(_ context.Context, value domain.Connector) error {
	s.connectors[value.ID] = value
	return nil
}
