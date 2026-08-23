package identity

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/mail"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type Store interface {
	FindPrincipalByExternal(context.Context, string, string, string) (domain.Principal, bool, error)
	FindPrincipalByVerifiedEmail(context.Context, string, string) (domain.Principal, bool, error)
	CreatePrincipal(context.Context, domain.Principal) error
	CreateGroup(context.Context, domain.IdentityGroup) error
	FindGroupByExternal(context.Context, string, string, string) (domain.IdentityGroup, bool, error)
	GetGroup(context.Context, string, string) (domain.IdentityGroup, bool, error)
	UpdateGroup(context.Context, domain.IdentityGroup) error
	ReplaceDirectMembers(context.Context, string, string, []string) error
	AddDirectMember(context.Context, string, string, string) error
	ListDirectMembers(context.Context, string, string) ([]string, error)
}

type MembershipProjector interface {
	ReconcileMembershipChange(context.Context, string, string) error
}

type Service struct {
	store          Store
	trustedIssuers map[string]struct{}
	memberships    MembershipProjector
}

func (s *Service) SetMembershipProjector(projector MembershipProjector) {
	if s != nil {
		s.memberships = projector
	}
}

func New(store Store, trustedIssuers []string) *Service {
	trusted := make(map[string]struct{}, len(trustedIssuers))
	for _, issuer := range trustedIssuers {
		trusted[strings.TrimRight(strings.TrimSpace(issuer), "/")] = struct{}{}
	}
	return &Service{store: store, trustedIssuers: trusted}
}

type DecisionError struct {
	Reason string
	Err    error
}

func (e *DecisionError) Error() string {
	if e.Err == nil {
		return e.Reason
	}
	return fmt.Sprintf("%s: %v", e.Reason, e.Err)
}
func (e *DecisionError) Unwrap() error { return e.Err }

type ExternalIdentity struct{ EnterpriseID, Issuer, Subject string }
type JITInput struct {
	EnterpriseID, ApplicationID, Issuer, Subject, Email, DisplayName string
	EmailVerified                                                    bool
}
type ManagedGroupInput struct{ EnterpriseID, Name string }
type DirectoryGroupInput struct{ EnterpriseID, Provider, ExternalID, Name string }

func (s *Service) ResolveExternalIdentity(ctx context.Context, input ExternalIdentity) (domain.Principal, error) {
	if s == nil || s.store == nil {
		return domain.Principal{}, decision("identity_unavailable", nil)
	}
	issuer, err := normalizeIssuer(input.Issuer)
	if err != nil || strings.TrimSpace(input.Subject) == "" {
		return domain.Principal{}, decision("identity_invalid", err)
	}
	value, found, err := s.store.FindPrincipalByExternal(ctx, input.EnterpriseID, issuer, input.Subject)
	if err != nil {
		return domain.Principal{}, decision("identity_store_error", err)
	}
	if !found {
		return domain.Principal{}, decision("identity_not_found", nil)
	}
	return value, nil
}

func (s *Service) AdmitJIT(ctx context.Context, input JITInput) (domain.Principal, error) {
	if s == nil || s.store == nil {
		return domain.Principal{}, decision("identity_unavailable", nil)
	}
	issuer, err := normalizeIssuer(input.Issuer)
	if err != nil || !input.EmailVerified || strings.TrimSpace(input.Subject) == "" {
		return domain.Principal{}, decision("jit_not_allowed", err)
	}
	if _, trusted := s.trustedIssuers[issuer]; !trusted {
		return domain.Principal{}, decision("jit_not_allowed", nil)
	}
	email, err := normalizeEmail(input.Email)
	if err != nil {
		return domain.Principal{}, decision("jit_not_allowed", err)
	}
	if existing, found, err := s.store.FindPrincipalByExternal(ctx, input.EnterpriseID, issuer, input.Subject); err != nil {
		return domain.Principal{}, decision("identity_store_error", err)
	} else if found {
		return existing, nil
	}
	if existing, found, err := s.store.FindPrincipalByVerifiedEmail(ctx, input.EnterpriseID, email); err != nil {
		return domain.Principal{}, decision("identity_store_error", err)
	} else if found && (existing.Issuer != issuer || existing.Subject != input.Subject) {
		return domain.Principal{}, decision("identity_conflict", nil)
	}
	now := time.Now().UTC()
	value := domain.Principal{Base: domain.Base{ID: newID("pri"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, OriginApplicationID: input.ApplicationID, Issuer: issuer, Subject: input.Subject, NormalizedEmail: email, DisplayName: strings.TrimSpace(input.DisplayName), Status: "active", Version: 1}
	if value.DisplayName == "" {
		value.DisplayName = email
	}
	if err := s.store.CreatePrincipal(ctx, value); err != nil {
		return domain.Principal{}, decision("identity_store_error", err)
	}
	return value, nil
}

func (s *Service) CreateManagedGroup(ctx context.Context, input ManagedGroupInput) (domain.IdentityGroup, error) {
	if s == nil || s.store == nil || input.EnterpriseID == "" || strings.TrimSpace(input.Name) == "" {
		return domain.IdentityGroup{}, decision("group_invalid", nil)
	}
	now := time.Now().UTC()
	value := domain.IdentityGroup{Base: domain.Base{ID: newID("grp"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, Provider: "ecp", ExternalID: newID("ext"), Name: strings.TrimSpace(input.Name), ManagementMode: domain.GroupManagedByECP, DirectMemberVersion: 1, Status: "active"}
	if err := s.store.CreateGroup(ctx, value); err != nil {
		return domain.IdentityGroup{}, decision("identity_store_error", err)
	}
	return value, nil
}

func (s *Service) SyncDirectoryGroup(ctx context.Context, input DirectoryGroupInput, principalIDs []string) (domain.IdentityGroup, error) {
	if s == nil || s.store == nil || input.EnterpriseID == "" || input.Provider == "" || input.ExternalID == "" || strings.TrimSpace(input.Name) == "" {
		return domain.IdentityGroup{}, decision("group_invalid", nil)
	}
	value, found, err := s.store.FindGroupByExternal(ctx, input.EnterpriseID, input.Provider, input.ExternalID)
	if err != nil {
		return domain.IdentityGroup{}, decision("identity_store_error", err)
	}
	now := time.Now().UTC()
	if !found {
		value = domain.IdentityGroup{Base: domain.Base{ID: newID("grp"), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, Provider: input.Provider, ExternalID: input.ExternalID, Name: strings.TrimSpace(input.Name), ManagementMode: domain.GroupManagedByDirectory, DirectMemberVersion: 1, Status: "active"}
		if err := s.store.CreateGroup(ctx, value); err != nil {
			return domain.IdentityGroup{}, decision("identity_store_error", err)
		}
	} else {
		if value.ManagementMode != domain.GroupManagedByDirectory {
			return domain.IdentityGroup{}, decision("group_management_conflict", nil)
		}
		value.Name, value.UpdatedAt = strings.TrimSpace(input.Name), now
		value.DirectMemberVersion++
		if err := s.store.UpdateGroup(ctx, value); err != nil {
			return domain.IdentityGroup{}, decision("identity_store_error", err)
		}
	}
	principalIDs = uniqueSorted(principalIDs)
	if err := s.store.ReplaceDirectMembers(ctx, input.EnterpriseID, value.ID, principalIDs); err != nil {
		return domain.IdentityGroup{}, decision("identity_store_error", err)
	}
	if err := s.reconcileMemberships(ctx, input.EnterpriseID, value.ID); err != nil {
		return domain.IdentityGroup{}, decision("membership_projection_error", err)
	}
	return value, nil
}

func (s *Service) AddDirectGroupMember(ctx context.Context, enterpriseID, groupID, principalID string) error {
	value, found, err := s.store.GetGroup(ctx, enterpriseID, groupID)
	if err != nil {
		return decision("identity_store_error", err)
	}
	if !found {
		return decision("group_not_found", nil)
	}
	if value.ManagementMode == domain.GroupManagedByDirectory {
		return decision("directory_group_read_only", nil)
	}
	if err := s.store.AddDirectMember(ctx, enterpriseID, groupID, principalID); err != nil {
		return decision("identity_store_error", err)
	}
	value.DirectMemberVersion++
	value.UpdatedAt = time.Now().UTC()
	if err := s.store.UpdateGroup(ctx, value); err != nil {
		return decision("identity_store_error", err)
	}
	if err := s.reconcileMemberships(ctx, enterpriseID, groupID); err != nil {
		return decision("membership_projection_error", err)
	}
	return nil
}

func (s *Service) reconcileMemberships(ctx context.Context, enterpriseID, groupID string) error {
	if s.memberships == nil {
		return nil
	}
	return s.memberships.ReconcileMembershipChange(ctx, enterpriseID, groupID)
}

func (s *Service) ListDirectGroupMembers(ctx context.Context, enterpriseID, groupID string) ([]string, error) {
	value, found, err := s.store.GetGroup(ctx, enterpriseID, groupID)
	if err != nil {
		return nil, decision("identity_store_error", err)
	}
	if !found {
		return nil, decision("group_not_found", nil)
	}
	return s.store.ListDirectMembers(ctx, enterpriseID, value.ID)
}

func normalizeIssuer(value string) (string, error) {
	parsed, err := url.Parse(strings.TrimRight(strings.TrimSpace(value), "/"))
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("issuer must be an absolute HTTPS URL")
	}
	return parsed.String(), nil
}
func normalizeEmail(value string) (string, error) {
	parsed, err := mail.ParseAddress(strings.TrimSpace(value))
	if err != nil || parsed.Address != strings.TrimSpace(value) {
		return "", fmt.Errorf("invalid email")
	}
	return strings.ToLower(parsed.Address), nil
}
func uniqueSorted(values []string) []string {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		if value != "" {
			set[value] = struct{}{}
		}
	}
	result := make([]string, 0, len(set))
	for value := range set {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}
func newID(prefix string) string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		panic(err)
	}
	return prefix + "_" + hex.EncodeToString(buffer)
}
func decision(reason string, err error) error { return &DecisionError{Reason: reason, Err: err} }
