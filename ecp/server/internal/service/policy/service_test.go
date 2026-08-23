package policy

import (
	"context"
	"errors"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
)

type fakeAdapter struct {
	policies []casdoor.Policy
	writeErr error
}

func (a *fakeAdapter) ReadPolicies(context.Context) ([]casdoor.Policy, error) {
	return append([]casdoor.Policy(nil), a.policies...), nil
}
func (a *fakeAdapter) WritePolicies(_ context.Context, values []casdoor.Policy) error {
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
func (a *fakeAdapter) DeletePolicies(_ context.Context, _ []casdoor.Policy) error {
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
}

func TestReconcileRejectsPermissionOutsidePolicyOwner(t *testing.T) {
	service := New(&memoryStore{}, &fakeAdapter{})
	_, err := service.Reconcile(context.Background(), ReconcileInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", CasdoorPermissionID: "attacker/admin", ManifestVersion: 1, Policies: []casdoor.Policy{{Owner: "acme", Name: "read", PType: "p"}}})
	if err == nil || err.Error() != "casdoor_permission_binding_invalid" {
		t.Fatalf("err=%v", err)
	}
}
