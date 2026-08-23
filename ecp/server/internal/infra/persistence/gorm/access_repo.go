package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"
	"gorm.io/gorm"
)

type AccessStore struct{ db *gorm.DB }

func NewAccessStore(db *gorm.DB) *AccessStore { return &AccessStore{db: db} }
func (s *AccessStore) BoundaryExists(ctx context.Context, enterpriseID, instanceID string) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).Table("application_instances").Where("enterprise_id = ? AND id = ? AND status = ?", enterpriseID, instanceID, "active").Count(&count).Error
	return count == 1, err
}
func (s *AccessStore) GetAccessState(ctx context.Context, enterpriseID, principalID, provider string) (domain.AccessState, error) {
	state := domain.AccessState{LifecycleState: "active"}
	var lifecycle domain.PrincipalLifecycle
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND principal_id = ?", enterpriseID, principalID).First(&lifecycle).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return state, err
	}
	if err == nil {
		state.LifecycleState = lifecycle.State
		state.LifecycleVersion = lifecycle.Version
	}
	var syncState domain.IdentitySyncState
	err = s.db.WithContext(ctx).Where("enterprise_id = ? AND provider = ?", enterpriseID, provider).First(&syncState).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return state, err
	}
	if err == nil {
		state.IdentitySyncVersion = syncState.Version
		if syncState.FreshnessDeadline != nil {
			state.IdentityFreshnessDeadline = *syncState.FreshnessDeadline
		}
	}
	return state, nil
}
func (s *AccessStore) GetPolicyProjection(ctx context.Context, enterpriseID, instanceID string) (domain.PolicyProjection, bool, error) {
	return getPolicyProjection(ctx, s.db, enterpriseID, instanceID)
}
func (s *AccessStore) GetSecurityConfig(ctx context.Context, enterpriseID, instanceID string) (domain.SecurityConfig, bool, error) {
	return getSecurityConfig(ctx, s.db, enterpriseID, instanceID)
}
