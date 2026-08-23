package policy

import (
	"context"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
)

type fakeAdapter struct{ policies []casdoor.Policy }

func (a *fakeAdapter) ReadPolicies(context.Context) ([]casdoor.Policy, error) {
	return append([]casdoor.Policy(nil), a.policies...), nil
}
func (a *fakeAdapter) WritePolicies(_ context.Context, values []casdoor.Policy) error {
	a.policies = append([]casdoor.Policy(nil), values...)
	return nil
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
	value, err := service.Reconcile(context.Background(), ReconcileInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", ManifestVersion: 2, Policies: []casdoor.Policy{{Owner: "acme", Name: "read", PType: "p", V0: "role:reader", V1: "project.read", V2: "allow"}}})
	if err != nil {
		t.Fatal(err)
	}
	if value.PolicyVersion != 1 || value.ReconciliationState != "in_sync" || value.NormalizedHash == "" {
		t.Fatalf("projection=%+v", value)
	}
}
