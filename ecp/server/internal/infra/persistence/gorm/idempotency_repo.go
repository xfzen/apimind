package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
)

type IdempotencyStore struct{ db *gorm.DB }

func NewIdempotencyStore(db *gorm.DB) *IdempotencyStore { return &IdempotencyStore{db: db} }
func (s *IdempotencyStore) GetByKey(ctx context.Context, enterpriseID, key string) (domain.IdempotencyRecord, bool, error) {
	var value domain.IdempotencyRecord
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND idempotency_key = ?", enterpriseID, key).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.IdempotencyRecord{}, false, nil
	}
	return value, err == nil, err
}
func (s *IdempotencyStore) Create(ctx context.Context, value domain.IdempotencyRecord) error {
	return s.db.WithContext(ctx).Create(&value).Error
}
func (s *IdempotencyStore) Complete(ctx context.Context, value domain.IdempotencyRecord) error {
	return s.db.WithContext(ctx).Model(&domain.IdempotencyRecord{}).Where("id = ? AND enterprise_id = ?", value.ID, value.EnterpriseID).Updates(map[string]any{"response_status": value.ResponseStatus, "response_body_hash": value.ResponseBodyHash, "state": value.State, "updated_at": value.UpdatedAt}).Error
}
