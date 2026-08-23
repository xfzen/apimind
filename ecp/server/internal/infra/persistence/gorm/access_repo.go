package persistence

import (
	"context"
	"errors"
	"time"

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
func (s *AccessStore) GetAuthorizationIdentity(ctx context.Context, enterpriseID, principalID string) (domain.AuthorizationIdentity, bool, error) {
	if len(principalID) > 5 && principalID[:5] == "cred_" {
		var credential domain.ServiceCredential
		err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, principalID).First(&credential).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domain.AuthorizationIdentity{}, false, nil
		}
		if err != nil {
			return domain.AuthorizationIdentity{}, false, err
		}
		return domain.AuthorizationIdentity{PrincipalKind: "service", IdentityProvider: "service_credential", PolicySubject: credential.ID}, true, nil
	}
	var principal domain.Principal
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ? AND status = ?", enterpriseID, principalID, "active").First(&principal).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.AuthorizationIdentity{}, false, nil
	}
	if err != nil {
		return domain.AuthorizationIdentity{}, false, err
	}
	var groups []domain.IdentityGroup
	err = s.db.WithContext(ctx).Table("identity_groups").
		Select("identity_groups.*").
		Joins("JOIN direct_group_memberships ON direct_group_memberships.group_id = identity_groups.id AND direct_group_memberships.enterprise_id = identity_groups.enterprise_id").
		Where("identity_groups.enterprise_id = ? AND direct_group_memberships.principal_id = ? AND identity_groups.status = ?", enterpriseID, principalID, "active").
		Order("identity_groups.id").Find(&groups).Error
	if err != nil {
		return domain.AuthorizationIdentity{}, false, err
	}
	groupIDs := make([]string, len(groups))
	var groupVersion uint64
	for index := range groups {
		groupIDs[index] = groups[index].ID
		if groups[index].DirectMemberVersion > groupVersion {
			groupVersion = groups[index].DirectMemberVersion
		}
	}
	return domain.AuthorizationIdentity{PrincipalKind: "human", IdentityProvider: principal.Issuer, PolicySubject: principal.ID, DirectGroupIDs: groupIDs, DirectGroupVersion: groupVersion}, true, nil
}
func (s *AccessStore) GetAccessState(ctx context.Context, enterpriseID, principalID, provider string) (domain.AccessState, error) {
	state := domain.AccessState{LifecycleState: "active"}
	if provider == "service_credential" {
		var credential domain.ServiceCredential
		if err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, principalID).First(&credential).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				state.LifecycleState = "blocked"
				return state, nil
			}
			return state, err
		}
		now := time.Now().UTC()
		active := credential.Status == "active" || (credential.Status == "rotating" && credential.OverlapUntil != nil && now.Before(*credential.OverlapUntil))
		if !active || !now.Before(credential.ExpiresAt) || credential.RevokedAt != nil {
			state.LifecycleState = "blocked"
		}
		state.LifecycleVersion = credential.Version
		return state, nil
	}
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
