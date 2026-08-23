package identity

import (
	"context"
	"strings"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

type memoryIdentityStore struct {
	principals map[string]domain.Principal
	groups     map[string]domain.IdentityGroup
	members    map[string][]string
}

type membershipProjectorFixture struct {
	enterpriseID, groupID string
	calls                 int
}

func (p *membershipProjectorFixture) ReconcileMembershipChange(_ context.Context, enterpriseID, groupID string) error {
	p.enterpriseID, p.groupID = enterpriseID, groupID
	p.calls++
	return nil
}

func (s *memoryIdentityStore) FindPrincipalByExternal(_ context.Context, enterpriseID, issuer, subject string) (domain.Principal, bool, error) {
	for _, value := range s.principals {
		if value.EnterpriseID == enterpriseID && value.Issuer == issuer && value.Subject == subject {
			return value, true, nil
		}
	}
	return domain.Principal{}, false, nil
}
func (s *memoryIdentityStore) FindPrincipalByVerifiedEmail(_ context.Context, enterpriseID, email string) (domain.Principal, bool, error) {
	for _, value := range s.principals {
		if value.EnterpriseID == enterpriseID && value.NormalizedEmail == email {
			return value, true, nil
		}
	}
	return domain.Principal{}, false, nil
}
func (s *memoryIdentityStore) CreatePrincipal(_ context.Context, value domain.Principal) error {
	if s.principals == nil {
		s.principals = make(map[string]domain.Principal)
	}
	s.principals[value.ID] = value
	return nil
}
func (s *memoryIdentityStore) CreateGroup(_ context.Context, value domain.IdentityGroup) error {
	if s.groups == nil {
		s.groups = make(map[string]domain.IdentityGroup)
	}
	s.groups[value.ID] = value
	return nil
}
func (s *memoryIdentityStore) GetGroup(_ context.Context, enterpriseID, id string) (domain.IdentityGroup, bool, error) {
	value, found := s.groups[id]
	return value, found && value.EnterpriseID == enterpriseID, nil
}
func (s *memoryIdentityStore) FindGroupByExternal(_ context.Context, enterpriseID, provider, externalID string) (domain.IdentityGroup, bool, error) {
	for _, value := range s.groups {
		if value.EnterpriseID == enterpriseID && value.Provider == provider && value.ExternalID == externalID {
			return value, true, nil
		}
	}
	return domain.IdentityGroup{}, false, nil
}
func (s *memoryIdentityStore) UpdateGroup(_ context.Context, value domain.IdentityGroup) error {
	s.groups[value.ID] = value
	return nil
}
func (s *memoryIdentityStore) ReplaceDirectMembers(_ context.Context, _, groupID string, principalIDs []string) error {
	s.members[groupID] = append([]string(nil), principalIDs...)
	return nil
}
func (s *memoryIdentityStore) AddDirectMember(_ context.Context, _, groupID, principalID string) error {
	s.members[groupID] = append(s.members[groupID], principalID)
	return nil
}
func (s *memoryIdentityStore) ListDirectMembers(_ context.Context, _, groupID string) ([]string, error) {
	return append([]string(nil), s.members[groupID]...), nil
}

func TestJITRejectsUnverifiedEmail(t *testing.T) {
	service := New(&memoryIdentityStore{}, []string{"https://trusted-idp.example.com"})
	_, err := service.AdmitJIT(context.Background(), JITInput{
		EnterpriseID: "ent-1", ApplicationID: "app-1", Issuer: "https://trusted-idp.example.com",
		Subject: "subject-1", Email: "user@example.com", EmailVerified: false,
	})
	assertReason(t, err, "jit_not_allowed")
}

func TestJITUsesIssuerAndSubjectRatherThanEmailAsIdentity(t *testing.T) {
	service := New(&memoryIdentityStore{}, []string{"https://trusted-idp.example.com"})
	first, err := service.AdmitJIT(context.Background(), JITInput{
		EnterpriseID: "ent-1", ApplicationID: "app-1", Issuer: "https://trusted-idp.example.com",
		Subject: "subject-1", Email: "User@Example.com", EmailVerified: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := service.ResolveExternalIdentity(context.Background(), ExternalIdentity{EnterpriseID: "ent-1", Issuer: first.Issuer, Subject: first.Subject})
	if err != nil {
		t.Fatal(err)
	}
	if resolved.ID != first.ID || first.NormalizedEmail != "user@example.com" {
		t.Fatalf("unexpected principal: %+v", resolved)
	}
	_, err = service.AdmitJIT(context.Background(), JITInput{
		EnterpriseID: "ent-1", ApplicationID: "app-1", Issuer: "https://trusted-idp.example.com",
		Subject: "subject-2", Email: "user@example.com", EmailVerified: true,
	})
	assertReason(t, err, "identity_conflict")
}

func TestDirectoryManagedGroupRejectsControlPlaneMutation(t *testing.T) {
	store := &memoryIdentityStore{members: make(map[string][]string)}
	service := New(store, nil)
	group, err := service.SyncDirectoryGroup(context.Background(), DirectoryGroupInput{EnterpriseID: "ent-1", Provider: "casdoor", ExternalID: "engineering", Name: "Engineering"}, []string{"principal-1"})
	if err != nil {
		t.Fatal(err)
	}
	err = service.AddDirectGroupMember(context.Background(), "ent-1", group.ID, "principal-2")
	assertReason(t, err, "directory_group_read_only")
}

func TestMembershipMutationTriggersRoleProjection(t *testing.T) {
	store := &memoryIdentityStore{members: make(map[string][]string)}
	projector := &membershipProjectorFixture{}
	service := New(store, nil)
	service.SetMembershipProjector(projector)
	group, err := service.CreateManagedGroup(context.Background(), ManagedGroupInput{EnterpriseID: "ent-1", Name: "Engineering"})
	if err != nil {
		t.Fatal(err)
	}
	if err := service.AddDirectGroupMember(context.Background(), "ent-1", group.ID, "principal-1"); err != nil {
		t.Fatal(err)
	}
	if projector.calls != 1 || projector.enterpriseID != "ent-1" || projector.groupID != group.ID {
		t.Fatalf("projector=%+v", projector)
	}
}

func assertReason(t *testing.T, err error, reason string) {
	t.Helper()
	if err == nil || !strings.Contains(err.Error(), reason) {
		t.Fatalf("expected %q, got %v", reason, err)
	}
}
