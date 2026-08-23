package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
)

func (s *RegistryStore) GetApplication(ctx context.Context, enterpriseID, id string) (domain.Application, bool, error) {
	var value domain.Application
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Application{}, false, nil
	}
	return value, err == nil, err
}

func (s *RegistryStore) CreateApplication(ctx context.Context, value domain.Application) error {
	return s.db.WithContext(ctx).Create(&value).Error
}

func (s *RegistryStore) GetInstance(ctx context.Context, enterpriseID, id string) (domain.ApplicationInstance, bool, error) {
	var value domain.ApplicationInstance
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ApplicationInstance{}, false, nil
	}
	return value, err == nil, err
}

func (s *RegistryStore) CreateInstance(ctx context.Context, value domain.ApplicationInstance) error {
	return s.db.WithContext(ctx).Create(&value).Error
}
