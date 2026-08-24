package persistence

import (
	"context"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (s *RegistryStore) GetManifest(ctx context.Context, enterpriseID, applicationID string) (domain.ProductManifest, bool, error) {
	var value domain.ProductManifest
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND application_id = ?", enterpriseID, applicationID).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ProductManifest{}, false, nil
	}
	return value, err == nil, err
}

func (s *RegistryStore) PutManifest(ctx context.Context, value domain.ProductManifest) (domain.ProductManifest, error) {
	db := s.db.WithContext(ctx)
	if err := db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "enterprise_id"}, {Name: "application_id"}},
		DoUpdates: clause.Assignments(map[string]any{
			"api_version":   value.APIVersion,
			"manifest_hash": value.ManifestHash,
			"body":          value.Body,
			"version":       gorm.Expr("product_manifests.version + ?", 1),
			"updated_at":    value.UpdatedAt,
		}),
	}).Create(&value).Error; err != nil {
		return domain.ProductManifest{}, err
	}
	var persisted domain.ProductManifest
	if err := db.Where("enterprise_id = ? AND application_id = ?", value.EnterpriseID, value.ApplicationID).First(&persisted).Error; err != nil {
		return domain.ProductManifest{}, err
	}
	return persisted, nil
}
