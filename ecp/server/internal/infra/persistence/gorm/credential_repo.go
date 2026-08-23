package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"
	"gorm.io/gorm"
)

type CredentialStore struct{ db *gorm.DB }

func NewCredentialStore(db *gorm.DB) *CredentialStore { return &CredentialStore{db: db} }
func (s *CredentialStore) Create(ctx context.Context, value domain.ServiceCredential) error {
	return s.db.WithContext(ctx).Create(&value).Error
}
func (s *CredentialStore) Get(ctx context.Context, id string) (domain.ServiceCredential, bool, error) {
	var value domain.ServiceCredential
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ServiceCredential{}, false, nil
	}
	return value, err == nil, err
}
func (s *CredentialStore) Update(ctx context.Context, value domain.ServiceCredential) error {
	return s.db.WithContext(ctx).Save(&value).Error
}
func (s *CredentialStore) ListUsage(ctx context.Context, enterpriseID, instanceID string) ([]domain.ServiceCredential, error) {
	var values []domain.ServiceCredential
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND application_instance_id = ?", enterpriseID, instanceID).Order("created_at DESC").Find(&values).Error
	return values, err
}
