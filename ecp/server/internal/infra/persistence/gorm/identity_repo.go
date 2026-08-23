package persistence

import (
	"context"
	"errors"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type IdentityStore struct{ db *gorm.DB }

func NewIdentityStore(db *gorm.DB) *IdentityStore { return &IdentityStore{db: db} }

func (s *IdentityStore) FindPrincipalByExternal(ctx context.Context, enterpriseID, issuer, subject string) (domain.Principal, bool, error) {
	var value domain.Principal
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND issuer = ? AND subject = ?", enterpriseID, issuer, subject).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Principal{}, false, nil
	}
	return value, err == nil, err
}

func (s *IdentityStore) FindPrincipalByVerifiedEmail(ctx context.Context, enterpriseID, email string) (domain.Principal, bool, error) {
	var value domain.Principal
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND normalized_email = ?", enterpriseID, email).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Principal{}, false, nil
	}
	return value, err == nil, err
}

func (s *IdentityStore) CreatePrincipal(ctx context.Context, value domain.Principal) error {
	return s.db.WithContext(ctx).Create(&value).Error
}
func (s *IdentityStore) CreateGroup(ctx context.Context, value domain.IdentityGroup) error {
	return s.db.WithContext(ctx).Create(&value).Error
}

func (s *IdentityStore) FindGroupByExternal(ctx context.Context, enterpriseID, provider, externalID string) (domain.IdentityGroup, bool, error) {
	var value domain.IdentityGroup
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND provider = ? AND external_id = ?", enterpriseID, provider, externalID).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.IdentityGroup{}, false, nil
	}
	return value, err == nil, err
}

func (s *IdentityStore) GetGroup(ctx context.Context, enterpriseID, id string) (domain.IdentityGroup, bool, error) {
	var value domain.IdentityGroup
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.IdentityGroup{}, false, nil
	}
	return value, err == nil, err
}

func (s *IdentityStore) UpdateGroup(ctx context.Context, value domain.IdentityGroup) error {
	return s.db.WithContext(ctx).Save(&value).Error
}

func (s *IdentityStore) ReplaceDirectMembers(ctx context.Context, enterpriseID, groupID string, principalIDs []string) error {
	return WithTx(ctx, s.db, func(tx *gorm.DB) error {
		if err := tx.Where("enterprise_id = ? AND group_id = ?", enterpriseID, groupID).Delete(&domain.DirectGroupMembership{}).Error; err != nil {
			return err
		}
		if len(principalIDs) == 0 {
			return nil
		}
		now := time.Now().UTC()
		values := make([]domain.DirectGroupMembership, 0, len(principalIDs))
		for _, principalID := range principalIDs {
			values = append(values, domain.DirectGroupMembership{EnterpriseID: enterpriseID, GroupID: groupID, PrincipalID: principalID, CreatedAt: now})
		}
		return tx.Create(&values).Error
	})
}

func (s *IdentityStore) AddDirectMember(ctx context.Context, enterpriseID, groupID, principalID string) error {
	value := domain.DirectGroupMembership{EnterpriseID: enterpriseID, GroupID: groupID, PrincipalID: principalID, CreatedAt: time.Now().UTC()}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&value).Error
}

func (s *IdentityStore) ListDirectMembers(ctx context.Context, enterpriseID, groupID string) ([]string, error) {
	var values []string
	err := s.db.WithContext(ctx).Model(&domain.DirectGroupMembership{}).Where("enterprise_id = ? AND group_id = ?", enterpriseID, groupID).Order("principal_id").Pluck("principal_id", &values).Error
	return values, err
}
