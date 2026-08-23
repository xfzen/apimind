package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
)

type RegistryStore struct{ db *gorm.DB }

func NewRegistryStore(db *gorm.DB) *RegistryStore { return &RegistryStore{db: db} }

func (s *RegistryStore) CountEnterprises(ctx context.Context) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&domain.Enterprise{}).Count(&count).Error
	return count, err
}

func (s *RegistryStore) CreateEnterprise(ctx context.Context, value domain.Enterprise) error {
	return s.db.WithContext(ctx).Create(&value).Error
}

func (s *RegistryStore) GetEnterprise(ctx context.Context, id string) (domain.Enterprise, bool, error) {
	var value domain.Enterprise
	err := s.db.WithContext(ctx).Where("enterprise_id = ?", id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Enterprise{}, false, nil
	}
	return value, err == nil, err
}
