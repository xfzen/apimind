package persistence

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	operationservice "github.com/xfzen/ecp/server/internal/service/operation"
	"gorm.io/gorm"
)

type OperationStore struct{ db *gorm.DB }

func NewOperationStore(db *gorm.DB) *OperationStore { return &OperationStore{db: db} }

func (s *OperationStore) LoadExportData(ctx context.Context, enterpriseID, instanceID string) (operationservice.ExportData, error) {
	var result operationservice.ExportData
	db := s.db.WithContext(ctx)
	var enterprise domain.Enterprise
	if err := db.Where("enterprise_id = ?", enterpriseID).First(&enterprise).Error; err != nil {
		return result, err
	}
	result.Enterprise = operationservice.EnterpriseMetadata{ID: enterprise.ID, Name: enterprise.Name, Status: enterprise.Status}
	var instance domain.ApplicationInstance
	if err := db.Where("enterprise_id = ? AND id = ?", enterpriseID, instanceID).First(&instance).Error; err != nil {
		return result, err
	}
	result.Instance = operationservice.InstanceMetadata{ID: instance.ID, ApplicationID: instance.ApplicationID, InstanceKey: instance.InstanceKey, Environment: instance.Environment, CanonicalURL: instance.CanonicalURL, Status: instance.Status, Version: instance.Version}
	var application domain.Application
	if err := db.Where("enterprise_id = ? AND id = ?", enterpriseID, instance.ApplicationID).First(&application).Error; err != nil {
		return result, err
	}
	result.Application = operationservice.ApplicationMetadata{ID: application.ID, Key: application.Key, Name: application.Name, Status: application.Status, Version: application.Version}
	var mappings []domain.LegacyIdentityMapping
	if err := db.Where("enterprise_id = ? AND application_id = ?", enterpriseID, application.ID).Order("legacy_source, legacy_subject").Find(&mappings).Error; err != nil {
		return result, err
	}
	for _, value := range mappings {
		result.IdentityMappings = append(result.IdentityMappings, operationservice.IdentityMappingMetadata{ID: value.ID, ApplicationID: value.ApplicationID, LegacySource: value.LegacySource, LegacySubject: value.LegacySubject, PrincipalID: value.PrincipalID})
	}
	var manifests []domain.ProductManifest
	if err := db.Where("enterprise_id = ? AND application_id = ?", enterpriseID, application.ID).Order("version").Find(&manifests).Error; err != nil {
		return result, err
	}
	for _, value := range manifests {
		result.Manifests = append(result.Manifests, operationservice.ManifestMetadata{APIVersion: value.APIVersion, Hash: value.ManifestHash, Version: value.Version})
	}
	var policy domain.PolicyProjection
	if err := db.Where("enterprise_id = ? AND application_instance_id = ?", enterpriseID, instanceID).First(&policy).Error; err == nil {
		result.Policy = &operationservice.PolicyMetadata{ApplicationInstanceID: policy.ApplicationInstanceID, PermissionID: policy.CasdoorPermissionID, PolicyIDs: policy.CasdoorPolicyIDs, CanonicalHash: policy.NormalizedHash, ManifestVersion: policy.ManifestVersion, PolicyVersion: policy.PolicyVersion, State: policy.ReconciliationState}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return result, err
	}
	var credentials []domain.ServiceCredential
	if err := db.Where("enterprise_id = ? AND application_instance_id = ?", enterpriseID, instanceID).Order("id").Find(&credentials).Error; err != nil {
		return result, err
	}
	for _, value := range credentials {
		var scopes []domain.CredentialScope
		_ = json.Unmarshal(value.ScopesJSON, &scopes)
		result.Credentials = append(result.Credentials, operationservice.CredentialMetadata{ID: value.ID, Name: value.Name, Status: value.Status, ScopeCount: len(scopes), ExpiresAt: value.ExpiresAt, Version: value.Version})
	}
	return result, nil
}

func (s *OperationStore) LatestBackup(ctx context.Context, enterpriseID string) (domain.BackupOperation, bool, error) {
	var value domain.BackupOperation
	err := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID).Order("started_at DESC").First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return value, false, nil
	}
	return value, err == nil, err
}

func (s *OperationStore) RecordBackup(ctx context.Context, value domain.BackupOperation) error {
	return s.db.WithContext(ctx).Save(&value).Error
}

func (s *OperationStore) BeginOffboarding(ctx context.Context, enterpriseID, instanceID string) (string, error) {
	result := s.db.WithContext(ctx).Model(&domain.ApplicationInstance{}).Where("enterprise_id = ? AND id = ? AND status = ?", enterpriseID, instanceID, "active").Updates(map[string]any{"status": "offboarding", "updated_at": time.Now().UTC(), "version": gorm.Expr("version + 1")})
	if result.Error != nil {
		return "", result.Error
	}
	if result.RowsAffected == 1 {
		return "offboarding", nil
	}
	var instance domain.ApplicationInstance
	if err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, instanceID).First(&instance).Error; err != nil {
		return "", err
	}
	if instance.Status != "offboarding" && instance.Status != "disabled" {
		return "", errors.New("product_instance_not_active")
	}
	return instance.Status, nil
}

func (s *OperationStore) RevokeProductSessions(ctx context.Context, enterpriseID, instanceID string) (int64, error) {
	now := time.Now().UTC()
	result := s.db.WithContext(ctx).Model(&domain.Session{}).Where("enterprise_id = ? AND application_instance_id = ? AND kind = ? AND revoked_at IS NULL", enterpriseID, instanceID, domain.SessionKindProduct).Updates(map[string]any{"revoked_at": now, "updated_at": now, "version": gorm.Expr("version + 1")})
	return result.RowsAffected, result.Error
}

func (s *OperationStore) RevokeInstanceCredentials(ctx context.Context, enterpriseID, instanceID string) (int64, error) {
	now := time.Now().UTC()
	result := s.db.WithContext(ctx).Model(&domain.ServiceCredential{}).Where("enterprise_id = ? AND application_instance_id = ? AND status IN ?", enterpriseID, instanceID, []string{"active", "rotating"}).Updates(map[string]any{"status": "revoked", "revoked_at": now, "updated_at": now, "version": gorm.Expr("version + 1")})
	return result.RowsAffected, result.Error
}

func (s *OperationStore) FinalLifecycleVersion(ctx context.Context, enterpriseID string) (uint64, error) {
	var version uint64
	err := s.db.WithContext(ctx).Model(&domain.PrincipalLifecycle{}).Where("enterprise_id = ?", enterpriseID).Select("COALESCE(MAX(version), 0)").Scan(&version).Error
	return version, err
}

func (s *OperationStore) DisableConnector(ctx context.Context, enterpriseID, instanceID string) error {
	now := time.Now().UTC()
	return WithTx(ctx, s.db, func(tx *gorm.DB) error {
		if err := tx.Model(&domain.Connector{}).Where("enterprise_id = ? AND instance_id = ?", enterpriseID, instanceID).Updates(map[string]any{"status": "disabled", "updated_at": now, "version": gorm.Expr("version + 1")}).Error; err != nil {
			return err
		}
		if err := tx.Model(&domain.ConnectorChannel{}).Where("enterprise_id = ? AND instance_id = ?", enterpriseID, instanceID).Updates(map[string]any{"status": "disabled", "updated_at": now}).Error; err != nil {
			return err
		}
		return tx.Model(&domain.ApplicationInstance{}).Where("enterprise_id = ? AND id = ?", enterpriseID, instanceID).Updates(map[string]any{"status": "disabled", "updated_at": now, "version": gorm.Expr("version + 1")}).Error
	})
}
