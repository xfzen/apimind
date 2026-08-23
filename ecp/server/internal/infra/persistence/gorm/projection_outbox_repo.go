package persistence

import (
	"context"

	"github.com/xfzen/ecp/server/internal/domain"
	"gorm.io/gorm"
)

type ProjectionOutboxStore struct{ db *gorm.DB }

func NewProjectionOutboxStore(db *gorm.DB) *ProjectionOutboxStore {
	return &ProjectionOutboxStore{db: db}
}
func (s *ProjectionOutboxStore) Enqueue(ctx context.Context, value domain.ProjectionOutbox) error {
	return s.db.WithContext(ctx).Create(&value).Error
}
func (s *ProjectionOutboxStore) Pending(ctx context.Context, instanceID string, limit int) ([]domain.ProjectionOutbox, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	var values []domain.ProjectionOutbox
	err := s.db.WithContext(ctx).Where("application_instance_id = ? AND state = ?", instanceID, "pending").Order("created_at ASC").Limit(limit).Find(&values).Error
	return values, err
}
func (s *ProjectionOutboxStore) MarkApplied(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Model(&domain.ProjectionOutbox{}).Where("id = ? AND state = ?", id, "pending").Update("state", "applied").Error
}
