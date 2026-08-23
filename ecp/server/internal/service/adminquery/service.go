package adminquery

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/internal/domain"
)

type Service struct{ store any }

func New(store any) *Service { return &Service{store: store} }

type principalLister interface {
	ListPrincipals(context.Context, string) ([]domain.Principal, error)
}
type principalGetter interface {
	GetPrincipal(context.Context, string, string) (domain.Principal, bool, error)
}
type groupLister interface {
	ListGroups(context.Context, string) ([]domain.IdentityGroup, error)
}
type groupGetter interface {
	GetGroup(context.Context, string, string) (domain.IdentityGroup, bool, error)
	ListDirectMembers(context.Context, string, string) ([]string, error)
}
type syncStateLister interface {
	ListSyncStates(context.Context, string) ([]domain.IdentitySyncState, error)
}
type applicationLister interface {
	ListApplications(context.Context, string) ([]domain.Application, error)
}
type instanceLister interface {
	ListInstances(context.Context, string, string) ([]domain.ApplicationInstance, error)
}
type instanceGetter interface {
	GetInstance(context.Context, string, string) (domain.ApplicationInstance, bool, error)
}
type manifestGetter interface {
	GetManifest(context.Context, string, string) (domain.ProductManifest, bool, error)
}

type GroupDetail struct {
	Group        domain.IdentityGroup
	PrincipalIDs []string
}

func (s *Service) ListPrincipals(ctx context.Context, enterpriseID string) ([]domain.Principal, error) {
	store, ok := s.store.(principalLister)
	if !ok || enterpriseID == "" {
		return nil, fmt.Errorf("admin_query_unavailable")
	}
	return store.ListPrincipals(ctx, enterpriseID)
}
func (s *Service) GetPrincipal(ctx context.Context, enterpriseID, id string) (domain.Principal, error) {
	store, ok := s.store.(principalGetter)
	if !ok || enterpriseID == "" || id == "" {
		return domain.Principal{}, fmt.Errorf("admin_query_unavailable")
	}
	value, found, err := store.GetPrincipal(ctx, enterpriseID, id)
	if err != nil {
		return domain.Principal{}, err
	}
	if !found {
		return domain.Principal{}, fmt.Errorf("principal_not_found")
	}
	return value, nil
}
func (s *Service) ListGroups(ctx context.Context, enterpriseID string) ([]domain.IdentityGroup, error) {
	store, ok := s.store.(groupLister)
	if !ok || enterpriseID == "" {
		return nil, fmt.Errorf("admin_query_unavailable")
	}
	return store.ListGroups(ctx, enterpriseID)
}
func (s *Service) GetGroup(ctx context.Context, enterpriseID, id string) (GroupDetail, error) {
	store, ok := s.store.(groupGetter)
	if !ok || enterpriseID == "" || id == "" {
		return GroupDetail{}, fmt.Errorf("admin_query_unavailable")
	}
	group, found, err := store.GetGroup(ctx, enterpriseID, id)
	if err != nil {
		return GroupDetail{}, err
	}
	if !found {
		return GroupDetail{}, fmt.Errorf("group_not_found")
	}
	members, err := store.ListDirectMembers(ctx, enterpriseID, id)
	return GroupDetail{Group: group, PrincipalIDs: members}, err
}
func (s *Service) ListIdentitySources(ctx context.Context, enterpriseID string) ([]domain.IdentitySyncState, error) {
	store, ok := s.store.(syncStateLister)
	if !ok || enterpriseID == "" {
		return nil, fmt.Errorf("admin_query_unavailable")
	}
	return store.ListSyncStates(ctx, enterpriseID)
}
func (s *Service) ListApplications(ctx context.Context, enterpriseID string) ([]domain.Application, error) {
	store, ok := s.store.(applicationLister)
	if !ok || enterpriseID == "" {
		return nil, fmt.Errorf("admin_query_unavailable")
	}
	return store.ListApplications(ctx, enterpriseID)
}
func (s *Service) ListInstances(ctx context.Context, enterpriseID, applicationID string) ([]domain.ApplicationInstance, error) {
	store, ok := s.store.(instanceLister)
	if !ok || enterpriseID == "" {
		return nil, fmt.Errorf("admin_query_unavailable")
	}
	return store.ListInstances(ctx, enterpriseID, applicationID)
}
func (s *Service) GetInstance(ctx context.Context, enterpriseID, id string) (domain.ApplicationInstance, error) {
	store, ok := s.store.(instanceGetter)
	if !ok || enterpriseID == "" || id == "" {
		return domain.ApplicationInstance{}, fmt.Errorf("admin_query_unavailable")
	}
	value, found, err := store.GetInstance(ctx, enterpriseID, id)
	if err != nil {
		return domain.ApplicationInstance{}, err
	}
	if !found {
		return domain.ApplicationInstance{}, fmt.Errorf("instance_not_found")
	}
	return value, nil
}
func (s *Service) GetManifest(ctx context.Context, enterpriseID, applicationID string) (domain.ProductManifest, error) {
	store, ok := s.store.(manifestGetter)
	if !ok || enterpriseID == "" || applicationID == "" {
		return domain.ProductManifest{}, fmt.Errorf("admin_query_unavailable")
	}
	value, found, err := store.GetManifest(ctx, enterpriseID, applicationID)
	if err != nil {
		return domain.ProductManifest{}, err
	}
	if !found {
		return domain.ProductManifest{}, fmt.Errorf("manifest_not_found")
	}
	return value, nil
}
