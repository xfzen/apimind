package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type LifecycleStore struct{ db *gorm.DB }

func NewLifecycleStore(db *gorm.DB) *LifecycleStore { return &LifecycleStore{db: db} }

func (s *LifecycleStore) GetLifecycle(ctx context.Context, enterpriseID, principalID string) (domain.PrincipalLifecycle, bool, error) {
	var value domain.PrincipalLifecycle
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND principal_id = ?", enterpriseID, principalID).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.PrincipalLifecycle{}, false, nil
	}
	return value, err == nil, err
}

func (s *LifecycleStore) PutLifecycle(ctx context.Context, value domain.PrincipalLifecycle) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "enterprise_id"}, {Name: "principal_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"state", "version", "blocked_at", "updated_at"}),
	}).Create(&value).Error
}

func (s *LifecycleStore) GetSyncState(ctx context.Context, enterpriseID, provider string) (domain.IdentitySyncState, bool, error) {
	var value domain.IdentitySyncState
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND provider = ?", enterpriseID, provider).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.IdentitySyncState{}, false, nil
	}
	return value, err == nil, err
}

func (s *LifecycleStore) PutSyncState(ctx context.Context, value domain.IdentitySyncState) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "enterprise_id"}, {Name: "provider"}},
		DoUpdates: clause.AssignmentColumns([]string{"version", "last_successful_sync", "freshness_deadline", "source_cursor", "state", "last_error", "updated_at"}),
	}).Create(&value).Error
}
