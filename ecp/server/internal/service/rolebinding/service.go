package rolebinding

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
	"github.com/xfzen/ecp/server/internal/manifest"
	accessservice "github.com/xfzen/ecp/server/internal/service/access"
	policyservice "github.com/xfzen/ecp/server/internal/service/policy"
)

type Store interface {
	GetInstance(context.Context, string, string) (domain.ApplicationInstance, bool, error)
	GetManifest(context.Context, string, string) (domain.ProductManifest, bool, error)
	GetPrincipal(context.Context, string, string) (domain.Principal, bool, error)
	GetGroup(context.Context, string, string) (domain.IdentityGroup, bool, error)
	ListDirectMemberships(context.Context, string) ([]domain.DirectGroupMembership, error)
	PutRoleBinding(context.Context, domain.RoleBinding) (domain.RoleBinding, error)
	ListRoleBindings(context.Context, string, string) ([]domain.RoleBinding, error)
}

type PolicyReconciler interface {
	Reconcile(context.Context, policyservice.ReconcileInput) (domain.PolicyProjection, error)
}

type Service struct {
	store        Store
	policies     PolicyReconciler
	organization string
	now          func() time.Time
}

type CreateInput struct {
	EnterpriseID, ApplicationInstanceID string
	SubjectType, SubjectID, RoleID      string
	ResourceType, ResourceID            string
}

func New(store Store, policies PolicyReconciler, organization string) *Service {
	return &Service{store: store, policies: policies, organization: organization, now: time.Now}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (domain.RoleBinding, error) {
	if s == nil || s.store == nil || s.policies == nil || s.organization == "" || input.EnterpriseID == "" || input.ApplicationInstanceID == "" || input.SubjectID == "" || input.ResourceID == "" || (input.SubjectType != "principal" && input.SubjectType != "group") || !manifest.IdentifierPattern.MatchString(input.RoleID) || !manifest.IdentifierPattern.MatchString(input.ResourceType) {
		return domain.RoleBinding{}, fmt.Errorf("role_binding_invalid")
	}
	instance, found, err := s.store.GetInstance(ctx, input.EnterpriseID, input.ApplicationInstanceID)
	if err != nil {
		return domain.RoleBinding{}, err
	}
	if !found || instance.ApplicationID == "" || instance.Status != "active" {
		return domain.RoleBinding{}, fmt.Errorf("application_instance_not_found")
	}
	if input.SubjectType == "principal" {
		principal, found, err := s.store.GetPrincipal(ctx, input.EnterpriseID, input.SubjectID)
		if err != nil {
			return domain.RoleBinding{}, err
		}
		if !found || principal.Status != "active" {
			return domain.RoleBinding{}, fmt.Errorf("principal_not_active")
		}
	} else {
		group, found, err := s.store.GetGroup(ctx, input.EnterpriseID, input.SubjectID)
		if err != nil {
			return domain.RoleBinding{}, err
		}
		if !found || group.Status != "active" {
			return domain.RoleBinding{}, fmt.Errorf("group_not_active")
		}
	}
	manifestRecord, found, err := s.store.GetManifest(ctx, input.EnterpriseID, instance.ApplicationID)
	if err != nil {
		return domain.RoleBinding{}, err
	}
	if !found {
		return domain.RoleBinding{}, fmt.Errorf("manifest_not_found")
	}
	manifestDocument, err := manifest.Parse(manifestRecord.Body)
	if err != nil {
		return domain.RoleBinding{}, err
	}
	roles := manifest.RoleMap(manifestDocument)
	role, found := roles[input.RoleID]
	if !found {
		return domain.RoleBinding{}, fmt.Errorf("role_not_declared")
	}
	if role.ResourceType != input.ResourceType {
		return domain.RoleBinding{}, fmt.Errorf("role_resource_type_mismatch")
	}
	now := s.now().UTC()
	value := domain.RoleBinding{Base: domain.Base{ID: newID(), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, ApplicationInstanceID: input.ApplicationInstanceID, SubjectType: input.SubjectType, SubjectID: input.SubjectID, RoleID: input.RoleID, ResourceType: input.ResourceType, ResourceID: input.ResourceID, Status: "active", Version: 1}
	persisted, err := s.store.PutRoleBinding(ctx, value)
	if err != nil {
		return domain.RoleBinding{}, err
	}
	bindings, err := s.store.ListRoleBindings(ctx, input.EnterpriseID, input.ApplicationInstanceID)
	if err != nil {
		return domain.RoleBinding{}, err
	}
	memberships, err := s.store.ListDirectMemberships(ctx, input.EnterpriseID)
	if err != nil {
		return domain.RoleBinding{}, err
	}
	policies, err := expandPolicies(bindings, memberships, roles, s.organization)
	if err != nil {
		return domain.RoleBinding{}, err
	}
	_, err = s.policies.Reconcile(ctx, policyservice.ReconcileInput{
		EnterpriseID: input.EnterpriseID, ApplicationInstanceID: input.ApplicationInstanceID,
		CasdoorPermissionID: s.organization + "/ecp-" + input.ApplicationInstanceID,
		ManifestVersion:     manifestRecord.Version, Policies: policies,
	})
	if err != nil {
		return domain.RoleBinding{}, err
	}
	return persisted, nil
}

func (s *Service) List(ctx context.Context, enterpriseID, instanceID string) ([]domain.RoleBinding, error) {
	if s == nil || s.store == nil || enterpriseID == "" || instanceID == "" {
		return nil, fmt.Errorf("role_binding_invalid")
	}
	return s.store.ListRoleBindings(ctx, enterpriseID, instanceID)
}

func expandPolicies(bindings []domain.RoleBinding, memberships []domain.DirectGroupMembership, roles map[string]manifest.Role, organization string) ([]casdoor.Policy, error) {
	policies := make([]casdoor.Policy, 0)
	boundGroups := make(map[string]struct{})
	for _, binding := range bindings {
		if binding.Status != "active" {
			continue
		}
		role, found := roles[binding.RoleID]
		if !found || role.ResourceType != binding.ResourceType {
			return nil, fmt.Errorf("binding_role_no_longer_declared")
		}
		for _, action := range role.Actions {
			digest := sha256.Sum256([]byte(binding.ID + "\x00" + action))
			policies = append(policies, casdoor.Policy{Owner: organization, Name: "binding-" + hex.EncodeToString(digest[:8]), PType: "p", V0: binding.SubjectID, V1: accessservice.PolicyResource(binding.ResourceType, binding.ResourceID), V2: action})
		}
		if binding.SubjectType == "group" {
			boundGroups[binding.SubjectID] = struct{}{}
		}
	}
	for _, membership := range memberships {
		if _, bound := boundGroups[membership.GroupID]; !bound {
			continue
		}
		digest := sha256.Sum256([]byte(membership.PrincipalID + "\x00" + membership.GroupID))
		policies = append(policies, casdoor.Policy{Owner: organization, Name: "membership-" + hex.EncodeToString(digest[:8]), PType: "g", V0: membership.PrincipalID, V1: membership.GroupID})
	}
	return policies, nil
}

func newID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return "rbd_" + hex.EncodeToString(value)
}
