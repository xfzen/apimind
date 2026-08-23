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
	GetRoleBinding(context.Context, string, string, string) (domain.RoleBinding, bool, error)
	UpdateRoleBinding(context.Context, domain.RoleBinding) error
	ListRoleBindings(context.Context, string, string) ([]domain.RoleBinding, error)
	ListBoundInstanceIDs(context.Context, string, string) ([]string, error)
	ListApplicationInstanceIDs(context.Context, string, string) ([]string, error)
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

type RevokeInput struct {
	EnterpriseID, ApplicationInstanceID, BindingID string
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
	if err := s.reconcileInstance(ctx, input.EnterpriseID, instance, manifestRecord, roles); err != nil {
		return domain.RoleBinding{}, err
	}
	return persisted, nil
}

func (s *Service) Revoke(ctx context.Context, input RevokeInput) error {
	if s == nil || s.store == nil || s.policies == nil || input.EnterpriseID == "" || input.ApplicationInstanceID == "" || input.BindingID == "" {
		return fmt.Errorf("role_binding_invalid")
	}
	binding, found, err := s.store.GetRoleBinding(ctx, input.EnterpriseID, input.ApplicationInstanceID, input.BindingID)
	if err != nil {
		return err
	}
	if !found {
		return fmt.Errorf("role_binding_not_found")
	}
	if binding.Status == "revoked" {
		return nil
	}
	binding.Status = "revoked"
	binding.Version++
	binding.UpdatedAt = s.now().UTC()
	if err := s.store.UpdateRoleBinding(ctx, binding); err != nil {
		return err
	}
	return s.ReconcileInstance(ctx, input.EnterpriseID, input.ApplicationInstanceID)
}

func (s *Service) ReconcileMembershipChange(ctx context.Context, enterpriseID, groupID string) error {
	if s == nil || s.store == nil || enterpriseID == "" || groupID == "" {
		return fmt.Errorf("role_binding_invalid")
	}
	instanceIDs, err := s.store.ListBoundInstanceIDs(ctx, enterpriseID, groupID)
	if err != nil {
		return err
	}
	for _, instanceID := range instanceIDs {
		if err := s.ReconcileInstance(ctx, enterpriseID, instanceID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) ReconcileApplicationManifest(ctx context.Context, enterpriseID, applicationID string) error {
	if s == nil || s.store == nil || enterpriseID == "" || applicationID == "" {
		return fmt.Errorf("role_binding_invalid")
	}
	instanceIDs, err := s.store.ListApplicationInstanceIDs(ctx, enterpriseID, applicationID)
	if err != nil {
		return err
	}
	for _, instanceID := range instanceIDs {
		if err := s.ReconcileInstance(ctx, enterpriseID, instanceID); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) ReconcileInstance(ctx context.Context, enterpriseID, instanceID string) error {
	instance, found, err := s.store.GetInstance(ctx, enterpriseID, instanceID)
	if err != nil {
		return err
	}
	if !found || instance.ApplicationID == "" || instance.Status != "active" {
		return fmt.Errorf("application_instance_not_found")
	}
	manifestRecord, found, err := s.store.GetManifest(ctx, enterpriseID, instance.ApplicationID)
	if err != nil {
		return err
	}
	if !found {
		return fmt.Errorf("manifest_not_found")
	}
	document, err := manifest.Parse(manifestRecord.Body)
	if err != nil {
		return err
	}
	return s.reconcileInstance(ctx, enterpriseID, instance, manifestRecord, manifest.RoleMap(document))
}

func (s *Service) reconcileInstance(ctx context.Context, enterpriseID string, instance domain.ApplicationInstance, manifestRecord domain.ProductManifest, roles map[string]manifest.Role) error {
	bindings, err := s.store.ListRoleBindings(ctx, enterpriseID, instance.ID)
	if err != nil {
		return err
	}
	for index := range bindings {
		if bindings[index].Status != "active" {
			continue
		}
		role, declared := roles[bindings[index].RoleID]
		if declared && role.ResourceType == bindings[index].ResourceType {
			continue
		}
		bindings[index].Status = "invalid_manifest"
		bindings[index].Version++
		bindings[index].UpdatedAt = s.now().UTC()
		if err := s.store.UpdateRoleBinding(ctx, bindings[index]); err != nil {
			return err
		}
	}
	memberships, err := s.store.ListDirectMemberships(ctx, enterpriseID)
	if err != nil {
		return err
	}
	policies, err := expandPolicies(bindings, memberships, roles, s.organization)
	if err != nil {
		return err
	}
	_, err = s.policies.Reconcile(ctx, policyservice.ReconcileInput{
		EnterpriseID: enterpriseID, ApplicationInstanceID: instance.ID,
		CasdoorPermissionID: s.organization + "/ecp-" + instance.ID,
		ManifestVersion:     manifestRecord.Version, Policies: policies,
	})
	return err
}

func (s *Service) List(ctx context.Context, enterpriseID, instanceID string) ([]domain.RoleBinding, error) {
	if s == nil || s.store == nil || enterpriseID == "" || instanceID == "" {
		return nil, fmt.Errorf("role_binding_invalid")
	}
	return s.store.ListRoleBindings(ctx, enterpriseID, instanceID)
}

func (s *Service) Get(ctx context.Context, enterpriseID, instanceID, bindingID string) (domain.RoleBinding, error) {
	if s == nil || s.store == nil || enterpriseID == "" || instanceID == "" || bindingID == "" {
		return domain.RoleBinding{}, fmt.Errorf("role_binding_invalid")
	}
	value, found, err := s.store.GetRoleBinding(ctx, enterpriseID, instanceID, bindingID)
	if err != nil {
		return domain.RoleBinding{}, err
	}
	if !found {
		return domain.RoleBinding{}, fmt.Errorf("role_binding_not_found")
	}
	return value, nil
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
