package oidcclient

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

type memoryStore struct{ clients map[string]domain.OIDCClient }

func (*memoryStore) InstanceBelongsTo(_ context.Context, enterpriseID, applicationID, instanceID string) (bool, error) {
	return enterpriseID == "ent-1" && applicationID == "app-1" && instanceID == "ins-1", nil
}

func (s *memoryStore) Create(_ context.Context, value domain.OIDCClient) error {
	if s.clients == nil {
		s.clients = make(map[string]domain.OIDCClient)
	}
	s.clients[value.ID] = value
	return nil
}

func (s *memoryStore) Get(_ context.Context, enterpriseID, id string) (domain.OIDCClient, bool, error) {
	value, found := s.clients[id]
	return value, found && value.EnterpriseID == enterpriseID, nil
}

func (s *memoryStore) GetByInstance(_ context.Context, enterpriseID, instanceID string) (domain.OIDCClient, bool, error) {
	for _, value := range s.clients {
		if value.EnterpriseID == enterpriseID && value.InstanceID == instanceID && value.Status == "active" {
			return value, true, nil
		}
	}
	return domain.OIDCClient{}, false, nil
}

func (s *memoryStore) Update(_ context.Context, value domain.OIDCClient) error {
	s.clients[value.ID] = value
	return nil
}

func TestValidateRedirectRequiresExactHTTPSURI(t *testing.T) {
	service := New(&memoryStore{}, false)
	err := service.ValidateRedirect([]string{"https://api.example.com/callback"}, "https://api.example.com/callback/extra")
	assertReason(t, err, "redirect_uri_mismatch")
	if err := service.ValidateRedirect([]string{"https://api.example.com/callback"}, "https://api.example.com/callback"); err != nil {
		t.Fatal(err)
	}
}

func TestProductCannotReadClientSecret(t *testing.T) {
	store := &memoryStore{}
	service := New(store, false)
	record, err := service.Register(context.Background(), RegisterInput{
		EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceID: "ins-1", ClientID: "client-1",
		SecretReference: "secret://oidc/client-1", RedirectURIs: []string{"https://api.example.com/callback"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if record.SecretReference == "" || strings.Contains(record.SecretReference, "secret-value") {
		t.Fatal("OIDC record must contain only a secret reference")
	}
}

func TestRegisterAcceptsStableBootstrapRecordID(t *testing.T) {
	record, err := New(&memoryStore{}, false).Register(context.Background(), RegisterInput{
		ID: "oidc-admin", EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceID: "ins-1", ClientID: "client-1",
		SecretReference: "secret://oidc/client-1", RedirectURIs: []string{"https://api.example.com/callback"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if record.ID != "oidc-admin" {
		t.Fatalf("record ID = %q, want stable bootstrap ID", record.ID)
	}
}

func TestEnsureConvergesStableBootstrapRecord(t *testing.T) {
	store := &memoryStore{}
	service := New(store, true)
	initial := RegisterInput{
		ID: "oidc-admin", EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceID: "ins-1", ClientID: "client-1",
		SecretReference: "secret://oidc/client-1", RedirectURIs: []string{"http://127.0.0.1:4001/api/v1/auth/callback"},
	}
	created, err := service.Ensure(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	initial.RedirectURIs = []string{"http://127.0.0.1:4001/auth/callback"}
	updated, err := service.Ensure(context.Background(), initial)
	if err != nil {
		t.Fatal(err)
	}
	if updated.ID != created.ID || updated.Version != created.Version+1 || len(updated.RedirectURIs) != 1 || updated.RedirectURIs[0] != initial.RedirectURIs[0] {
		t.Fatalf("created=%+v updated=%+v", created, updated)
	}
}

func TestLocalhostRedirectRequiresLocalMode(t *testing.T) {
	input := RegisterInput{
		EnterpriseID: "ent-1", ApplicationID: "app-1", InstanceID: "ins-1", ClientID: "client-1",
		SecretReference: "secret://oidc/client-1", RedirectURIs: []string{"http://127.0.0.1:4000/callback"},
	}
	_, err := New(&memoryStore{}, false).Register(context.Background(), input)
	assertReason(t, err, "redirect_uri_invalid")
	if _, err := New(&memoryStore{}, true).Register(context.Background(), input); err != nil {
		t.Fatal(err)
	}
}

func TestClientCannotBeBoundAcrossApplicationInstanceBoundary(t *testing.T) {
	_, err := New(&memoryStore{}, false).Register(context.Background(), RegisterInput{
		EnterpriseID: "ent-1", ApplicationID: "app-2", InstanceID: "ins-1", ClientID: "client-1",
		SecretReference: "secret://oidc/client-1", RedirectURIs: []string{"https://api.example.com/callback"},
	})
	assertReason(t, err, "oidc_client_instance_mismatch")
}

func TestProductionRouterDoesNotExposeDynamicClientRegistration(t *testing.T) {
	routes, err := os.ReadFile(filepath.Join("..", "..", "..", "api", "internal", "handler", "routes.go"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(routes), "/api/v1/oidc/register") {
		t.Fatal("production router exposes dynamic client registration")
	}
}

func assertReason(t *testing.T, err error, reason string) {
	t.Helper()
	var decision *DecisionError
	if err == nil || !strings.Contains(err.Error(), reason) || !AsDecision(err, &decision) || decision.Reason != reason {
		t.Fatalf("expected reason %q, got %v", reason, err)
	}
}
