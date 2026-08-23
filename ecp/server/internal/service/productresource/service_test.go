package productresource

import (
	"context"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type instanceSourceFixture struct{ instance domain.ApplicationInstance }

func (s instanceSourceFixture) GetInstance(context.Context, string, string) (domain.ApplicationInstance, bool, error) {
	return s.instance, s.instance.ID != "", nil
}

type delegationStateFixture struct{ state domain.DelegationState }

func (s delegationStateFixture) DelegationState(context.Context, string, string, string) (domain.DelegationState, error) {
	return s.state, nil
}

type delegationSignerFixture struct{ value domain.Delegation }

func (s *delegationSignerFixture) IssueDelegation(_ context.Context, value domain.Delegation) (domain.SignedDelegation, error) {
	s.value = value
	return domain.SignedDelegation{Algorithm: domain.AlgorithmEdDSA, KeyID: "key-1"}, nil
}

type productClientFixture struct {
	delegation domain.SignedDelegation
	input      SearchInput
}

func (c *productClientFixture) SearchResources(_ context.Context, delegation domain.SignedDelegation, input SearchInput) ([]domain.ResourceReference, error) {
	c.delegation, c.input = delegation, input
	return []domain.ResourceReference{{ResourceType: "project", ExternalID: "project-1", DisplayName: "Visible", ResourceVersion: 3}}, nil
}
func (*productClientFixture) ResolveResource(context.Context, domain.SignedDelegation, ResourceInput) (domain.ResourceReference, error) {
	return domain.ResourceReference{}, nil
}
func (*productClientFixture) GetResourceAncestry(context.Context, domain.SignedDelegation, ResourceInput) ([]domain.ResourceReference, error) {
	return nil, nil
}

type clientResolverFixture struct{ client ProductClient }

func (r clientResolverFixture) ResolveClient(context.Context, domain.ApplicationInstance) (ProductClient, error) {
	return r.client, nil
}

func TestSearchIssuesFreshActorBoundDelegationBeforeCallingProduct(t *testing.T) {
	now := time.Date(2026, 8, 24, 5, 0, 0, 0, time.UTC)
	signer := &delegationSignerFixture{}
	client := &productClientFixture{}
	service := New(
		instanceSourceFixture{instance: domain.ApplicationInstance{Base: domain.Base{ID: "instance-1", EnterpriseID: "enterprise-1"}, ApplicationID: "apimind", Status: "active"}},
		delegationStateFixture{state: domain.DelegationState{PolicyVersion: 7, LifecycleVersion: 8, IdentitySyncVersion: 9, IdentityFreshnessDeadline: now.Add(45 * time.Second)}},
		signer,
		clientResolverFixture{client: client},
	)
	service.now = func() time.Time { return now }
	service.token = func() string { return "opaque" }

	resources, err := service.Search(context.Background(), Actor{EnterpriseID: "enterprise-1", PrincipalID: "principal-1", SessionID: "session-1"}, SearchInput{
		InstanceID: "instance-1", ResourceType: "project", Query: "visible", RequestedAction: "project.member.manage", Limit: 20,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(resources) != 1 || resources[0].ExternalID != "project-1" {
		t.Fatalf("resources=%+v", resources)
	}
	if signer.value.ActorPrincipalID != "principal-1" || signer.value.AdminSessionID != "session-1" || signer.value.Audience != "instance-1" || signer.value.PolicyVersion != 7 || signer.value.LifecycleVersion != 8 || signer.value.IdentitySyncVersion != 9 || !signer.value.ExpiresAt.Equal(now.Add(45*time.Second)) {
		t.Fatalf("delegation=%+v", signer.value)
	}
	if client.input.ResourceType != "project" || client.input.RequestedAction != "project.member.manage" || client.delegation.KeyID != "key-1" {
		t.Fatalf("product call input=%+v delegation=%+v", client.input, client.delegation)
	}
}

func TestSearchRejectsCrossEnterpriseInstance(t *testing.T) {
	service := New(
		instanceSourceFixture{instance: domain.ApplicationInstance{Base: domain.Base{ID: "instance-1", EnterpriseID: "enterprise-2"}, ApplicationID: "apimind", Status: "active"}},
		delegationStateFixture{}, &delegationSignerFixture{}, clientResolverFixture{client: &productClientFixture{}},
	)
	if _, err := service.Search(context.Background(), Actor{EnterpriseID: "enterprise-1", PrincipalID: "principal-1", SessionID: "session-1"}, SearchInput{InstanceID: "instance-1", ResourceType: "project", RequestedAction: "project.read"}); err == nil {
		t.Fatal("expected cross-enterprise instance rejection")
	}
}
