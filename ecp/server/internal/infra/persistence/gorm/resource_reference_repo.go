package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"
	"gorm.io/gorm"
)

type ResourceReferenceStore struct{ db *gorm.DB }

func NewResourceReferenceStore(db *gorm.DB) *ResourceReferenceStore {
	return &ResourceReferenceStore{db: db}
}
func (s *ResourceReferenceStore) Put(ctx context.Context, value domain.ResourceReference) error {
	return s.db.WithContext(ctx).Save(&value).Error
}
func (s *ResourceReferenceStore) ResolveVisible(ctx context.Context, enterpriseID, instanceID, resourceType, externalID string) (domain.ResourceReference, bool, error) {
	var value domain.ResourceReference
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND application_instance_id = ? AND resource_type = ? AND external_id = ? AND visible = ?", enterpriseID, instanceID, resourceType, externalID, true).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ResourceReference{}, false, nil
	}
	return value, err == nil, err
}
func (s *ResourceReferenceStore) SearchVisible(ctx context.Context, enterpriseID, instanceID, resourceType, query string, limit int) ([]domain.ResourceReference, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var values []domain.ResourceReference
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND application_instance_id = ? AND resource_type = ? AND visible = ? AND LOWER(display_name) LIKE LOWER(?)", enterpriseID, instanceID, resourceType, true, "%"+query+"%").Order("external_id ASC").Limit(limit).Find(&values).Error
	return values, err
}
