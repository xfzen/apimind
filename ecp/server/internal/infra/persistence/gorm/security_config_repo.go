package persistence

import (
	"context"
	"errors"
	"github.com/xfzen/ecp/server/internal/domain"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SecurityConfigStore struct{ db *gorm.DB }

func NewSecurityConfigStore(db *gorm.DB) *SecurityConfigStore { return &SecurityConfigStore{db: db} }
func getSecurityConfig(ctx context.Context, db *gorm.DB, enterpriseID, instanceID string) (domain.SecurityConfig, bool, error) {
	var value domain.SecurityConfig
	err := db.WithContext(ctx).Where("enterprise_id = ? AND application_instance_id = ?", enterpriseID, instanceID).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.SecurityConfig{}, false, nil
	}
	return value, err == nil, err
}
func (s *SecurityConfigStore) Get(ctx context.Context, enterpriseID, instanceID string) (domain.SecurityConfig, bool, error) {
	return getSecurityConfig(ctx, s.db, enterpriseID, instanceID)
}
func (s *SecurityConfigStore) Put(ctx context.Context, value domain.SecurityConfig) (domain.SecurityConfig, error) {
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "enterprise_id"}, {Name: "application_instance_id"}}, DoUpdates: clause.AssignmentColumns([]string{"public_sharing", "export_enabled", "secret_export", "version", "updated_at"})}).Create(&value).Error
	if err != nil {
		return domain.SecurityConfig{}, err
	}
	persisted, _, err := s.Get(ctx, value.EnterpriseID, value.ApplicationInstanceID)
	return persisted, err
}
