package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
)

type AdminQueryStore struct{ db *gorm.DB }

func NewAdminQueryStore(db *gorm.DB) *AdminQueryStore { return &AdminQueryStore{db: db} }

func (s *AdminQueryStore) ListPrincipals(ctx context.Context, enterpriseID string) ([]domain.Principal, error) {
	var values []domain.Principal
	err := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID).Order("display_name, id").Find(&values).Error
	return values, err
}
func (s *AdminQueryStore) GetPrincipal(ctx context.Context, enterpriseID, id string) (domain.Principal, bool, error) {
	var value domain.Principal
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}
func (s *AdminQueryStore) ListGroups(ctx context.Context, enterpriseID string) ([]domain.IdentityGroup, error) {
	var values []domain.IdentityGroup
	err := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID).Order("name, id").Find(&values).Error
	return values, err
}
func (s *AdminQueryStore) GetGroup(ctx context.Context, enterpriseID, id string) (domain.IdentityGroup, bool, error) {
	var value domain.IdentityGroup
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}
func (s *AdminQueryStore) ListDirectMembers(ctx context.Context, enterpriseID, groupID string) ([]string, error) {
	var values []string
	err := s.db.WithContext(ctx).Model(&domain.DirectGroupMembership{}).Where("enterprise_id = ? AND group_id = ?", enterpriseID, groupID).Order("principal_id").Pluck("principal_id", &values).Error
	return values, err
}
func (s *AdminQueryStore) ListSyncStates(ctx context.Context, enterpriseID string) ([]domain.IdentitySyncState, error) {
	var values []domain.IdentitySyncState
	err := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID).Order("provider, id").Find(&values).Error
	return values, err
}
func (s *AdminQueryStore) ListApplications(ctx context.Context, enterpriseID string) ([]domain.Application, error) {
	var values []domain.Application
	err := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID).Order("name, id").Find(&values).Error
	return values, err
}
func (s *AdminQueryStore) ListInstances(ctx context.Context, enterpriseID, applicationID string) ([]domain.ApplicationInstance, error) {
	var values []domain.ApplicationInstance
	query := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID)
	if applicationID != "" {
		query = query.Where("application_id = ?", applicationID)
	}
	err := query.Order("application_id, instance_key, id").Find(&values).Error
	return values, err
}
func (s *AdminQueryStore) GetInstance(ctx context.Context, enterpriseID, id string) (domain.ApplicationInstance, bool, error) {
	var value domain.ApplicationInstance
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}
func (s *AdminQueryStore) GetManifest(ctx context.Context, enterpriseID, applicationID string) (domain.ProductManifest, bool, error) {
	var value domain.ProductManifest
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND application_id = ?", enterpriseID, applicationID).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}
