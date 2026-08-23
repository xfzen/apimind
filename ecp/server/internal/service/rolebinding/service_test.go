package rolebinding

import (
	"context"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	policyservice "github.com/xfzen/ecp/server/internal/service/policy"
)

type roleStoreFixture struct {
	instance    domain.ApplicationInstance
	manifest    domain.ProductManifest
	principal   domain.Principal
	group       domain.IdentityGroup
	memberships []domain.DirectGroupMembership
	bindings    []domain.RoleBinding
}

func (s *roleStoreFixture) GetInstance(context.Context, string, string) (domain.ApplicationInstance, bool, error) {
	return s.instance, true, nil
}
func (s *roleStoreFixture) GetManifest(context.Context, string, string) (domain.ProductManifest, bool, error) {
	return s.manifest, true, nil
}
func (s *roleStoreFixture) GetPrincipal(context.Context, string, string) (domain.Principal, bool, error) {
	return s.principal, true, nil
}
func (s *roleStoreFixture) GetGroup(context.Context, string, string) (domain.IdentityGroup, bool, error) {
	return s.group, true, nil
}
func (s *roleStoreFixture) ListDirectMemberships(context.Context, string) ([]domain.DirectGroupMembership, error) {
	return append([]domain.DirectGroupMembership(nil), s.memberships...), nil
}
func (s *roleStoreFixture) PutRoleBinding(_ context.Context, value domain.RoleBinding) (domain.RoleBinding, error) {
	s.bindings = append(s.bindings, value)
	return value, nil
}
func (s *roleStoreFixture) ListRoleBindings(context.Context, string, string) ([]domain.RoleBinding, error) {
	return append([]domain.RoleBinding(nil), s.bindings...), nil
}

type reconcilerFixture struct{ input policyservice.ReconcileInput }

func (r *reconcilerFixture) Reconcile(_ context.Context, input policyservice.ReconcileInput) (domain.PolicyProjection, error) {
	r.input = input
	return domain.PolicyProjection{PolicyVersion: 1, ReconciliationState: "in_sync"}, nil
}

func roleFixture() *roleStoreFixture {
	now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
	return &roleStoreFixture{
		instance:  domain.ApplicationInstance{Base: domain.Base{ID: "ins-1", EnterpriseID: "ent-1"}, ApplicationID: "app-1", Status: "active"},
		principal: domain.Principal{Base: domain.Base{ID: "pri-1", EnterpriseID: "ent-1"}, Status: "active"},
		group:     domain.IdentityGroup{Base: domain.Base{ID: "grp-1", EnterpriseID: "ent-1"}, Status: "active"},
		manifest:  domain.ProductManifest{Base: domain.Base{ID: "man-1", EnterpriseID: "ent-1", CreatedAt: now}, ApplicationID: "app-1", Version: 3, Body: []byte(`{"schema_version":"connector.manifest/v1","roles":[{"id":"project.viewer","resource_type":"project","actions":["project.read","document.read"]}]}`)},
	}
}

func TestCreateRoleBindingExpandsOnlyManifestDeclaredActions(t *testing.T) {
	store, reconciler := roleFixture(), &reconcilerFixture{}
	service := New(store, reconciler, "acme")
	created, err := service.Create(context.Background(), CreateInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "project.viewer", ResourceType: "project", ResourceID: "42"})
	if err != nil {
		t.Fatal(err)
	}
	if created.ID == "" || created.RoleID != "project.viewer" || created.Status != "active" {
		t.Fatalf("binding=%+v", created)
	}
	if reconciler.input.CasdoorPermissionID != "acme/ecp-ins-1" || reconciler.input.ManifestVersion != 3 || len(reconciler.input.Policies) != 2 {
		t.Fatalf("reconcile=%+v", reconciler.input)
	}
	for _, policy := range reconciler.input.Policies {
		if policy.Owner != "acme" || policy.PType != "p" || policy.V0 != "pri-1" || policy.V1 != "project:42" {
			t.Fatalf("policy=%+v", policy)
		}
	}
}

func TestCreateRoleBindingRejectsRoleOutsideAcceptedManifest(t *testing.T) {
	service := New(roleFixture(), &reconcilerFixture{}, "acme")
	_, err := service.Create(context.Background(), CreateInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "project.owner", ResourceType: "project", ResourceID: "42"})
	if err == nil || err.Error() != "role_not_declared" {
		t.Fatalf("err=%v", err)
	}
}

func TestGroupRoleBindingEmitsMembershipPolicies(t *testing.T) {
	store, reconciler := roleFixture(), &reconcilerFixture{}
	store.memberships = []domain.DirectGroupMembership{{EnterpriseID: "ent-1", GroupID: "grp-1", PrincipalID: "pri-1"}}
	service := New(store, reconciler, "acme")
	_, err := service.Create(context.Background(), CreateInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", SubjectType: "group", SubjectID: "grp-1", RoleID: "project.viewer", ResourceType: "project", ResourceID: "42"})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, policy := range reconciler.input.Policies {
		if policy.PType == "g" && policy.V0 == "pri-1" && policy.V1 == "grp-1" {
			found = true
		}
	}
	if !found {
		t.Fatalf("policies=%+v", reconciler.input.Policies)
	}
}
