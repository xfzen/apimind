package productresource

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type Actor struct {
	EnterpriseID string
	PrincipalID  string
	SessionID    string
}

type SearchInput struct {
	InstanceID, ResourceType, Query, RequestedAction string
	Limit                                            int
}

type ResourceInput struct {
	InstanceID, ResourceType, ResourceID, RequestedAction string
}

type InstanceSource interface {
	GetInstance(context.Context, string, string) (domain.ApplicationInstance, bool, error)
}

type DelegationStateSource interface {
	DelegationState(context.Context, string, string, string) (domain.DelegationState, error)
}

type DelegationSigner interface {
	IssueDelegation(context.Context, domain.Delegation) (domain.SignedDelegation, error)
}

type ProductClient interface {
	SearchResources(context.Context, domain.SignedDelegation, SearchInput) ([]domain.ResourceReference, error)
	ResolveResource(context.Context, domain.SignedDelegation, ResourceInput) (domain.ResourceReference, error)
	GetResourceAncestry(context.Context, domain.SignedDelegation, ResourceInput) ([]domain.ResourceReference, error)
}

type ClientResolver interface {
	ResolveClient(context.Context, domain.ApplicationInstance) (ProductClient, error)
}

type Service struct {
	instances InstanceSource
	states    DelegationStateSource
	signer    DelegationSigner
	clients   ClientResolver
	now       func() time.Time
	token     func() string
}

func New(instances InstanceSource, states DelegationStateSource, signer DelegationSigner, clients ClientResolver) *Service {
	return &Service{instances: instances, states: states, signer: signer, clients: clients, now: time.Now, token: opaqueToken}
}

func (s *Service) Search(ctx context.Context, actor Actor, input SearchInput) ([]domain.ResourceReference, error) {
	delegation, instance, err := s.prepare(ctx, actor, input.InstanceID, input.ResourceType, "", input.RequestedAction)
	if err != nil {
		return nil, err
	}
	client, err := s.clients.ResolveClient(ctx, instance)
	if err != nil {
		return nil, err
	}
	return client.SearchResources(ctx, delegation, input)
}

func (s *Service) Resolve(ctx context.Context, actor Actor, input ResourceInput) (domain.ResourceReference, error) {
	delegation, instance, err := s.prepare(ctx, actor, input.InstanceID, input.ResourceType, input.ResourceID, input.RequestedAction)
	if err != nil {
		return domain.ResourceReference{}, err
	}
	client, err := s.clients.ResolveClient(ctx, instance)
	if err != nil {
		return domain.ResourceReference{}, err
	}
	return client.ResolveResource(ctx, delegation, input)
}

func (s *Service) Ancestry(ctx context.Context, actor Actor, input ResourceInput) ([]domain.ResourceReference, error) {
	delegation, instance, err := s.prepare(ctx, actor, input.InstanceID, input.ResourceType, input.ResourceID, input.RequestedAction)
	if err != nil {
		return nil, err
	}
	client, err := s.clients.ResolveClient(ctx, instance)
	if err != nil {
		return nil, err
	}
	return client.GetResourceAncestry(ctx, delegation, input)
}

func (s *Service) prepare(ctx context.Context, actor Actor, instanceID, resourceType, resourceID, requestedAction string) (domain.SignedDelegation, domain.ApplicationInstance, error) {
	if s == nil || s.instances == nil || s.states == nil || s.signer == nil || s.clients == nil || actor.EnterpriseID == "" || actor.PrincipalID == "" || actor.SessionID == "" || instanceID == "" || resourceType == "" || requestedAction == "" {
		return domain.SignedDelegation{}, domain.ApplicationInstance{}, fmt.Errorf("product_resource_request_invalid")
	}
	instance, found, err := s.instances.GetInstance(ctx, actor.EnterpriseID, instanceID)
	if err != nil {
		return domain.SignedDelegation{}, domain.ApplicationInstance{}, err
	}
	if !found || instance.EnterpriseID != actor.EnterpriseID || instance.ID != instanceID || instance.ApplicationID == "" || instance.Status != "active" {
		return domain.SignedDelegation{}, domain.ApplicationInstance{}, fmt.Errorf("product_instance_not_found")
	}
	state, err := s.states.DelegationState(ctx, actor.EnterpriseID, instanceID, actor.PrincipalID)
	if err != nil {
		return domain.SignedDelegation{}, domain.ApplicationInstance{}, err
	}
	now := s.now().UTC()
	expiresAt := now.Add(time.Minute)
	if state.IdentityFreshnessDeadline.IsZero() || !now.Before(state.IdentityFreshnessDeadline) {
		return domain.SignedDelegation{}, domain.ApplicationInstance{}, fmt.Errorf("identity_state_stale")
	}
	if state.IdentityFreshnessDeadline.Before(expiresAt) {
		expiresAt = state.IdentityFreshnessDeadline
	}
	value := domain.Delegation{
		Audience: instanceID, Subject: actor.PrincipalID, EnterpriseID: actor.EnterpriseID, ApplicationID: instance.ApplicationID,
		InstanceID: instanceID, ResourceType: resourceType, ResourceID: resourceID, Actions: []string{requestedAction},
		ActorPrincipalID: actor.PrincipalID, AdminSessionID: actor.SessionID, RequestedAction: requestedAction,
		Purpose: domain.DelegationPurposeProduct, OperationID: s.token(), Nonce: s.token(), IssuedAt: now, ExpiresAt: expiresAt,
		PolicyVersion: state.PolicyVersion, LifecycleVersion: state.LifecycleVersion, IdentitySyncVersion: state.IdentitySyncVersion,
		IdentityFreshnessDeadline: state.IdentityFreshnessDeadline,
	}
	signed, err := s.signer.IssueDelegation(ctx, value)
	return signed, instance, err
}

func opaqueToken() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return hex.EncodeToString(value)
}
