package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RoleBindingStore struct{ db *gorm.DB }

func NewRoleBindingStore(db *gorm.DB) *RoleBindingStore { return &RoleBindingStore{db: db} }

func (s *RoleBindingStore) GetInstance(ctx context.Context, enterpriseID, id string) (domain.ApplicationInstance, bool, error) {
	var value domain.ApplicationInstance
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}

func (s *RoleBindingStore) GetManifest(ctx context.Context, enterpriseID, applicationID string) (domain.ProductManifest, bool, error) {
	var value domain.ProductManifest
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND application_id = ?", enterpriseID, applicationID).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}

func (s *RoleBindingStore) GetPrincipal(ctx context.Context, enterpriseID, id string) (domain.Principal, bool, error) {
	var value domain.Principal
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}

func (s *RoleBindingStore) GetGroup(ctx context.Context, enterpriseID, id string) (domain.IdentityGroup, bool, error) {
	var value domain.IdentityGroup
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}

func (s *RoleBindingStore) ListDirectMemberships(ctx context.Context, enterpriseID string) ([]domain.DirectGroupMembership, error) {
	var values []domain.DirectGroupMembership
	err := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID).Order("group_id, principal_id").Find(&values).Error
	return values, err
}

func (s *RoleBindingStore) PutRoleBinding(ctx context.Context, value domain.RoleBinding) (domain.RoleBinding, error) {
	db := s.db.WithContext(ctx)
	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "enterprise_id"}, {Name: "application_instance_id"}, {Name: "subject_type"}, {Name: "subject_id"}, {Name: "role_id"}, {Name: "resource_type"}, {Name: "resource_id"}},
		DoNothing: true,
	}).Create(&value).Error; err != nil {
		return domain.RoleBinding{}, err
	}
	var persisted domain.RoleBinding
	err := db.Where("enterprise_id = ? AND application_instance_id = ? AND subject_type = ? AND subject_id = ? AND role_id = ? AND resource_type = ? AND resource_id = ?", value.EnterpriseID, value.ApplicationInstanceID, value.SubjectType, value.SubjectID, value.RoleID, value.ResourceType, value.ResourceID).First(&persisted).Error
	return persisted, err
}

func (s *RoleBindingStore) ListRoleBindings(ctx context.Context, enterpriseID, instanceID string) ([]domain.RoleBinding, error) {
	var values []domain.RoleBinding
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND application_instance_id = ?", enterpriseID, instanceID).Order("subject_type, subject_id, role_id, resource_type, resource_id, id").Find(&values).Error
	return values, err
}
