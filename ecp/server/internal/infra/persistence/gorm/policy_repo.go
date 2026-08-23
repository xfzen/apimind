package persistence

import (
	"context"
	"errors"
	"github.com/xfzen/ecp/server/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type PolicyStore struct{ db *gorm.DB }

func NewPolicyStore(db *gorm.DB) *PolicyStore { return &PolicyStore{db: db} }
func getPolicyProjection(ctx context.Context, db *gorm.DB, enterpriseID, instanceID string) (domain.PolicyProjection, bool, error) {
	var value domain.PolicyProjection
	err := db.WithContext(ctx).Where("enterprise_id = ? AND application_instance_id = ?", enterpriseID, instanceID).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.PolicyProjection{}, false, nil
	}
	return value, err == nil, err
}
func (s *PolicyStore) Get(ctx context.Context, enterpriseID, instanceID string) (domain.PolicyProjection, bool, error) {
	return getPolicyProjection(ctx, s.db, enterpriseID, instanceID)
}
func (s *PolicyStore) Put(ctx context.Context, value domain.PolicyProjection) (domain.PolicyProjection, error) {
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "enterprise_id"}, {Name: "application_instance_id"}}, DoUpdates: clause.AssignmentColumns([]string{"casdoor_permission_id", "casdoor_policy_ids", "normalized_hash", "manifest_version", "policy_version", "reconciliation_state", "last_error", "updated_at"})}).Create(&value).Error
	if err != nil {
		return domain.PolicyProjection{}, err
	}
	persisted, _, err := s.Get(ctx, value.EnterpriseID, value.ApplicationInstanceID)
	return persisted, err
}
