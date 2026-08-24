package credential

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type memoryStore struct {
	values map[string]domain.ServiceCredential
}

func (s *memoryStore) Create(_ context.Context, value domain.ServiceCredential) error {
	s.values[value.ID] = value
	return nil
}
func (s *memoryStore) Get(_ context.Context, id string) (domain.ServiceCredential, bool, error) {
	value, ok := s.values[id]
	return value, ok, nil
}
func (s *memoryStore) Update(_ context.Context, value domain.ServiceCredential) error {
	s.values[value.ID] = value
	return nil
}
func (s *memoryStore) ListUsage(_ context.Context, enterpriseID, instanceID string) ([]domain.ServiceCredential, error) {
	var values []domain.ServiceCredential
	for _, value := range s.values {
		if value.EnterpriseID == enterpriseID && value.ApplicationInstanceID == instanceID {
			values = append(values, value)
		}
	}
	return values, nil
}

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }

func fixture() (*Service, *memoryStore, *fakeClock) {
	store := &memoryStore{values: map[string]domain.ServiceCredential{}}
	clock := &fakeClock{now: time.Date(2026, 8, 24, 1, 0, 0, 0, time.UTC)}
	return New(store, Config{Clock: clock, RotationOverlap: 5 * time.Minute, MaximumLifetime: 24 * time.Hour}), store, clock
}

func TestCreateReturnsSecretOnceAndStoresDigest(t *testing.T) {
	svc, store, _ := fixture()
	created, err := svc.Create(context.Background(), CreateInput{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", Name: "automation", Scopes: []domain.CredentialScope{{ResourceType: "project", ResourceID: "project-1", Actions: []string{"project.read"}}}, Lifetime: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	if created.Secret == "" {
		t.Fatal("secret was not returned")
	}
	if len(created.ID) > 36 {
		t.Fatalf("credential id exceeds the persisted identifier boundary: %q", created.ID)
	}
	stored := store.values[created.ID]
	if stored.SecretDigest == "" || strings.Contains(stored.SecretDigest, created.Secret) || strings.Contains(string(stored.ScopesJSON), created.Secret) {
		t.Fatal("raw secret leaked into persistence")
	}
}

func TestAuthenticateEnforcesProductInstanceResourceAndActionScope(t *testing.T) {
	svc, _, _ := fixture()
	created, err := svc.Create(context.Background(), CreateInput{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", Name: "reader", Scopes: []domain.CredentialScope{{ResourceType: "project", ResourceID: "project-1", Actions: []string{"project.read"}}}, Lifetime: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Authenticate(context.Background(), created.Secret, AccessRequest{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", ResourceType: "project", ResourceID: "project-1", Action: "project.read"}); err != nil {
		t.Fatal(err)
	}
	for _, request := range []AccessRequest{
		{EnterpriseID: "enterprise-1", ApplicationID: "other", ApplicationInstanceID: "instance-a", ResourceType: "project", ResourceID: "project-1", Action: "project.read"},
		{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-b", ResourceType: "project", ResourceID: "project-1", Action: "project.read"},
		{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", ResourceType: "project", ResourceID: "project-2", Action: "project.read"},
		{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", ResourceType: "project", ResourceID: "project-1", Action: "project.delete"},
		{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", ResourceType: "project", ResourceID: "project-1", Action: "project.read", DelegatedUserOperation: true},
	} {
		if _, err := svc.Authenticate(context.Background(), created.Secret, request); reason(err) != "credential_scope_denied" {
			t.Fatalf("request=%+v reason=%q", request, reason(err))
		}
	}
}

func TestRotationOverlapThenRevocation(t *testing.T) {
	svc, _, clock := fixture()
	created, err := svc.Create(context.Background(), CreateInput{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", Name: "reader", Scopes: []domain.CredentialScope{{ResourceType: "project", ResourceID: "*", Actions: []string{"project.read"}}}, Lifetime: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	rotated, err := svc.Rotate(context.Background(), created.ID, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	request := AccessRequest{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", ResourceType: "project", ResourceID: "project-1", Action: "project.read"}
	if _, err := svc.Authenticate(context.Background(), created.Secret, request); err != nil {
		t.Fatal(err)
	}
	clock.now = clock.now.Add(6 * time.Minute)
	if _, err := svc.Authenticate(context.Background(), created.Secret, request); reason(err) != "credential_inactive" {
		t.Fatalf("old reason=%q", reason(err))
	}
	if err := svc.Revoke(context.Background(), rotated.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Authenticate(context.Background(), rotated.Secret, request); reason(err) != "credential_inactive" {
		t.Fatalf("revoked reason=%q", reason(err))
	}
}

func TestEnterpriseAdminCannotRotateOrRevokeAnotherEnterpriseCredential(t *testing.T) {
	svc, store, _ := fixture()
	created, err := svc.Create(context.Background(), CreateInput{EnterpriseID: "enterprise-1", ApplicationID: "apimind", ApplicationInstanceID: "instance-a", Name: "reader", Scopes: []domain.CredentialScope{{ResourceType: "project", ResourceID: "*", Actions: []string{"project.read"}}}, Lifetime: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.RotateForEnterprise(context.Background(), "enterprise-2", created.ID, time.Hour); reason(err) != "credential_inactive" {
		t.Fatalf("rotate reason=%q", reason(err))
	}
	if err := svc.RevokeForEnterprise(context.Background(), "enterprise-2", created.ID); reason(err) != "credential_not_found" {
		t.Fatalf("revoke reason=%q", reason(err))
	}
	if got := store.values[created.ID].Status; got != "active" {
		t.Fatalf("credential mutated across enterprise boundary: %s", got)
	}
}
