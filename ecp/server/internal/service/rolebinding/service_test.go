package rolebinding

import (
	"context"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	policyservice "github.com/xfzen/ecp/server/internal/service/policy"
)

type roleStoreFixture struct {
	instance             domain.ApplicationInstance
	manifest             domain.ProductManifest
	principal            domain.Principal
	group                domain.IdentityGroup
	memberships          []domain.DirectGroupMembership
	bindings             []domain.RoleBinding
	instances            []string
	applicationInstances []string
}

func (s *roleStoreFixture) GetInstance(_ context.Context, _ string, id string) (domain.ApplicationInstance, bool, error) {
	value := s.instance
	value.ID = id
	return value, true, nil
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
func (s *roleStoreFixture) ListRoleBindings(_ context.Context, _ string, instanceID string) ([]domain.RoleBinding, error) {
	values := make([]domain.RoleBinding, 0, len(s.bindings))
	for _, binding := range s.bindings {
		if binding.ApplicationInstanceID == instanceID {
			values = append(values, binding)
		}
	}
	return values, nil
}
func (s *roleStoreFixture) GetRoleBinding(_ context.Context, enterpriseID, instanceID, id string) (domain.RoleBinding, bool, error) {
	for _, binding := range s.bindings {
		if binding.EnterpriseID == enterpriseID && binding.ApplicationInstanceID == instanceID && binding.ID == id {
			return binding, true, nil
		}
	}
	return domain.RoleBinding{}, false, nil
}
func (s *roleStoreFixture) UpdateRoleBinding(_ context.Context, value domain.RoleBinding) error {
	for index := range s.bindings {
		if s.bindings[index].ID == value.ID {
			s.bindings[index] = value
			return nil
		}
	}
	return nil
}
func (s *roleStoreFixture) ListBoundInstanceIDs(context.Context, string, string) ([]string, error) {
	return append([]string(nil), s.instances...), nil
}
func (s *roleStoreFixture) ListApplicationInstanceIDs(context.Context, string, string) ([]string, error) {
	return append([]string(nil), s.applicationInstances...), nil
}

type reconcilerFixture struct {
	inputs []policyservice.ReconcileInput
}

func (r *reconcilerFixture) Reconcile(_ context.Context, input policyservice.ReconcileInput) (domain.PolicyProjection, error) {
	r.inputs = append(r.inputs, input)
	return domain.PolicyProjection{PolicyVersion: 1, ReconciliationState: "in_sync"}, nil
}

func (r *reconcilerFixture) last() policyservice.ReconcileInput {
	return r.inputs[len(r.inputs)-1]
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
	input := reconciler.last()
	if input.CasdoorPermissionID != "acme/ecp-ins-1" || input.ManifestVersion != 3 || len(input.Policies) != 2 {
		t.Fatalf("reconcile=%+v", input)
	}
	for _, policy := range input.Policies {
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

func TestInitialSelfBindingAllowsManifestManagementRole(t *testing.T) {
	store := roleFixture()
	store.manifest.Body = []byte(`{"schema_version":"connector.manifest/v1","roles":[{"id":"workspace.admin","resource_type":"workspace","actions":["workspace.read","workspace.member.manage"]}]}`)
	service := New(store, &reconcilerFixture{}, "acme")
	allowed, err := service.CanBootstrap(context.Background(), CreateInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "workspace.admin", ResourceType: "workspace", ResourceID: "261"}, "pri-1")
	if err != nil || !allowed {
		t.Fatalf("allowed=%v err=%v", allowed, err)
	}
}

func TestInitialBindingCannotGrantAnotherSubjectOrNonManagementRole(t *testing.T) {
	store := roleFixture()
	service := New(store, &reconcilerFixture{}, "acme")
	allowed, err := service.CanBootstrap(context.Background(), CreateInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-2", RoleID: "project.viewer", ResourceType: "project", ResourceID: "42"}, "pri-1")
	if err != nil || allowed {
		t.Fatalf("allowed=%v err=%v", allowed, err)
	}
}

func TestInitialBindingClosesAfterAnyActiveBinding(t *testing.T) {
	store := roleFixture()
	store.manifest.Body = []byte(`{"schema_version":"connector.manifest/v1","roles":[{"id":"workspace.admin","resource_type":"workspace","actions":["workspace.member.manage"]}]}`)
	store.bindings = []domain.RoleBinding{{Base: domain.Base{ID: "rbd-1", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", Status: "active"}}
	service := New(store, &reconcilerFixture{}, "acme")
	allowed, err := service.CanBootstrap(context.Background(), CreateInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "workspace.admin", ResourceType: "workspace", ResourceID: "261"}, "pri-1")
	if err != nil || allowed {
		t.Fatalf("allowed=%v err=%v", allowed, err)
	}
}

func TestInitialBindingCanRetrySameSelfManagementGrantAfterProjectionFailure(t *testing.T) {
	store := roleFixture()
	store.manifest.Body = []byte(`{"schema_version":"connector.manifest/v1","roles":[{"id":"workspace.admin","resource_type":"workspace","actions":["workspace.member.manage"]}]}`)
	store.bindings = []domain.RoleBinding{{Base: domain.Base{ID: "rbd-1", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "workspace.admin", ResourceType: "workspace", ResourceID: "261", Status: "active"}}
	service := New(store, &reconcilerFixture{}, "acme")
	allowed, err := service.CanBootstrap(context.Background(), CreateInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "workspace.admin", ResourceType: "workspace", ResourceID: "261"}, "pri-1")
	if err != nil || !allowed {
		t.Fatalf("allowed=%v err=%v", allowed, err)
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
	for _, policy := range reconciler.last().Policies {
		if policy.PType == "g" && policy.V0 == "pri-1" && policy.V1 == "grp-1" {
			found = true
		}
	}
	if !found {
		t.Fatalf("policies=%+v", reconciler.last().Policies)
	}
}

func TestRevokeRoleBindingRemovesItsPolicies(t *testing.T) {
	store, reconciler := roleFixture(), &reconcilerFixture{}
	store.bindings = []domain.RoleBinding{
		{Base: domain.Base{ID: "rbd-remove", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "project.viewer", ResourceType: "project", ResourceID: "42", Status: "active", Version: 1},
		{Base: domain.Base{ID: "rbd-keep", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "project.viewer", ResourceType: "project", ResourceID: "43", Status: "active", Version: 1},
	}
	service := New(store, reconciler, "acme")
	if err := service.Revoke(context.Background(), RevokeInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", BindingID: "rbd-remove"}); err != nil {
		t.Fatal(err)
	}
	if store.bindings[0].Status != "revoked" || store.bindings[0].Version != 2 {
		t.Fatalf("binding=%+v", store.bindings[0])
	}
	for _, policy := range reconciler.last().Policies {
		if policy.V1 == "project:42" {
			t.Fatalf("revoked resource remains projected: %+v", policy)
		}
	}
}

func TestMembershipChangeReconcilesEveryInstanceBoundToGroup(t *testing.T) {
	store, reconciler := roleFixture(), &reconcilerFixture{}
	store.instances = []string{"ins-1", "ins-2"}
	store.memberships = []domain.DirectGroupMembership{{EnterpriseID: "ent-1", GroupID: "grp-1", PrincipalID: "pri-2"}}
	store.bindings = []domain.RoleBinding{{Base: domain.Base{ID: "rbd-group", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", SubjectType: "group", SubjectID: "grp-1", RoleID: "project.viewer", ResourceType: "project", ResourceID: "42", Status: "active", Version: 1}}
	service := New(store, reconciler, "acme")
	if err := service.ReconcileMembershipChange(context.Background(), "ent-1", "grp-1"); err != nil {
		t.Fatal(err)
	}
	if len(reconciler.inputs) != 2 {
		t.Fatalf("reconciliations=%d", len(reconciler.inputs))
	}
	found := false
	for _, policy := range reconciler.inputs[0].Policies {
		if policy.PType == "g" && policy.V0 == "pri-2" && policy.V1 == "grp-1" {
			found = true
		}
	}
	if !found {
		t.Fatalf("policies=%+v", reconciler.inputs[0].Policies)
	}
}

func TestManifestChangeReconcilesEveryApplicationInstance(t *testing.T) {
	store, reconciler := roleFixture(), &reconcilerFixture{}
	store.applicationInstances = []string{"ins-1", "ins-2"}
	service := New(store, reconciler, "acme")
	if err := service.ReconcileApplicationManifest(context.Background(), "ent-1", "app-1"); err != nil {
		t.Fatal(err)
	}
	if len(reconciler.inputs) != 2 || reconciler.inputs[0].ApplicationInstanceID != "ins-1" || reconciler.inputs[1].ApplicationInstanceID != "ins-2" {
		t.Fatalf("reconciliations=%+v", reconciler.inputs)
	}
}

func TestManifestRemovalInvalidatesBindingAndRemovesPolicy(t *testing.T) {
	store, reconciler := roleFixture(), &reconcilerFixture{}
	store.bindings = []domain.RoleBinding{{Base: domain.Base{ID: "rbd-owner", EnterpriseID: "ent-1"}, ApplicationInstanceID: "ins-1", SubjectType: "principal", SubjectID: "pri-1", RoleID: "project.owner", ResourceType: "project", ResourceID: "42", Status: "active", Version: 1}}
	service := New(store, reconciler, "acme")
	if err := service.ReconcileInstance(context.Background(), "ent-1", "ins-1"); err != nil {
		t.Fatal(err)
	}
	if store.bindings[0].Status != "invalid_manifest" || store.bindings[0].Version != 2 {
		t.Fatalf("binding=%+v", store.bindings[0])
	}
	if len(reconciler.last().Policies) != 0 {
		t.Fatalf("policies=%+v", reconciler.last().Policies)
	}
}
