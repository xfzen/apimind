package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
)

type OIDCClientStore struct{ db *gorm.DB }

func NewOIDCClientStore(db *gorm.DB) *OIDCClientStore { return &OIDCClientStore{db: db} }

func (s *OIDCClientStore) Create(ctx context.Context, value domain.OIDCClient) error {
	return s.db.WithContext(ctx).Create(&value).Error
}

func (s *OIDCClientStore) Get(ctx context.Context, enterpriseID, id string) (domain.OIDCClient, bool, error) {
	var value domain.OIDCClient
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.OIDCClient{}, false, nil
	}
	return value, err == nil, err
}

func (s *OIDCClientStore) Update(ctx context.Context, value domain.OIDCClient) error {
	return s.db.WithContext(ctx).Save(&value).Error
}

func (s *OIDCClientStore) InstanceBelongsTo(ctx context.Context, enterpriseID, applicationID, instanceID string) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Table("application_instances").
		Where("enterprise_id = ? AND application_id = ? AND id = ?", enterpriseID, applicationID, instanceID).
		Count(&count).Error
	return count == 1, err
}
