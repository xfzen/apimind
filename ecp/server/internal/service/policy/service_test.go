package policy

import (
	"context"
	"errors"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
)

type fakeAdapter struct {
	policies   []casdoor.Policy
	writeErr   error
	boundaries []string
}

func (a *fakeAdapter) ReadPolicies(_ context.Context, boundary string) ([]casdoor.Policy, error) {
	a.boundaries = append(a.boundaries, boundary)
	values := append([]casdoor.Policy(nil), a.policies...)
	for index := range values {
		values[index].Owner = ""
		values[index].Name = ""
	}
	return values, nil
}
func (a *fakeAdapter) WritePolicies(_ context.Context, boundary string, values []casdoor.Policy) error {
	a.boundaries = append(a.boundaries, boundary)
	if a.writeErr != nil {
		return a.writeErr
	}
	a.policies = append([]casdoor.Policy(nil), values...)
	return nil
}

func TestReconcileMarksProjectionDriftedBeforeReturningMutationFailure(t *testing.T) {
	adapter, store := &fakeAdapter{writeErr: errors.New("casdoor unavailable")}, &memoryStore{}
	service := New(store, adapter)
	_, err := service.Reconcile(context.Background(), ReconcileInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", CasdoorPermissionID: "acme/apimind-ins-1", ManifestVersion: 2, Policies: []casdoor.Policy{{Owner: "acme", Name: "read", PType: "p", V0: "principal-1", V1: "project:1", V2: "project.read"}}})
	if err == nil {
		t.Fatal("expected mutation failure")
	}
	if store.value.ReconciliationState != "drifted" || store.value.PolicyVersion != 1 {
		t.Fatalf("projection=%+v", store.value)
	}
}
func (a *fakeAdapter) DeletePolicies(_ context.Context, boundary string, _ []casdoor.Policy) error {
	a.boundaries = append(a.boundaries, boundary)
	a.policies = nil
	return nil
}

type memoryStore struct{ value domain.PolicyProjection }

func (s *memoryStore) Get(_ context.Context, enterpriseID, instanceID string) (domain.PolicyProjection, bool, error) {
	return s.value, s.value.EnterpriseID == enterpriseID && s.value.ApplicationInstanceID == instanceID, nil
}
func (s *memoryStore) Put(_ context.Context, value domain.PolicyProjection) (domain.PolicyProjection, error) {
	s.value = value
	return value, nil
}
func TestMutationReadsBackCanonicalPolicyAndAdvancesVersion(t *testing.T) {
	adapter, store := &fakeAdapter{}, &memoryStore{}
	service := New(store, adapter)
	value, err := service.Reconcile(context.Background(), ReconcileInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", CasdoorPermissionID: "acme/apimind-ins-1", ManifestVersion: 2, Policies: []casdoor.Policy{{Owner: "acme", Name: "read", PType: "p", V0: "role:reader", V1: "project.read", V2: "allow"}}})
	if err != nil {
		t.Fatal(err)
	}
	if value.PolicyVersion != 1 || value.ReconciliationState != "in_sync" || value.NormalizedHash == "" || value.CasdoorPermissionID != "acme/apimind-ins-1" {
		t.Fatalf("projection=%+v", value)
	}
	for _, boundary := range adapter.boundaries {
		if boundary != "acme/apimind-ins-1" {
			t.Fatalf("unexpected policy boundary %q", boundary)
		}
	}
	if len(value.CasdoorPolicyIDs) != 1 || len(value.CasdoorPolicyIDs[0]) != len("rule-")+16 {
		t.Fatalf("policy ids=%v", value.CasdoorPolicyIDs)
	}
}

func TestReconcileAcceptsEmptyDesiredPolicySetToRemoveLastBinding(t *testing.T) {
	adapter := &fakeAdapter{policies: []casdoor.Policy{{PType: "p", V0: "principal-1", V1: "workspace:1", V2: "workspace.read"}}}
	store := &memoryStore{}
	service := New(store, adapter)
	value, err := service.Reconcile(context.Background(), ReconcileInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", CasdoorPermissionID: "acme/apimind-ins-1", ManifestVersion: 2})
	if err != nil {
		t.Fatal(err)
	}
	if len(adapter.policies) != 0 || value.ReconciliationState != "in_sync" || len(value.CasdoorPolicyIDs) != 0 {
		t.Fatalf("adapter=%+v projection=%+v", adapter.policies, value)
	}
}

func TestReconcileRejectsPermissionOutsidePolicyOwner(t *testing.T) {
	service := New(&memoryStore{}, &fakeAdapter{})
	_, err := service.Reconcile(context.Background(), ReconcileInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", CasdoorPermissionID: "attacker/admin", ManifestVersion: 1, Policies: []casdoor.Policy{{Owner: "acme", Name: "read", PType: "p"}}})
	if err == nil || err.Error() != "casdoor_permission_binding_invalid" {
		t.Fatalf("err=%v", err)
	}
}
