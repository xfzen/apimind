package persistence

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/xfzen/ecp/server/internal/domain"
	"gorm.io/gorm"
)

func (s *RegistryStore) CreateConnector(ctx context.Context, value domain.Connector) error {
	return s.db.WithContext(ctx).Create(&value).Error
}

func (s *RegistryStore) GetConnector(ctx context.Context, enterpriseID, id string) (domain.Connector, bool, error) {
	var value domain.Connector
	err := s.db.WithContext(ctx).Where("enterprise_id = ? AND id = ?", enterpriseID, id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Connector{}, false, nil
	}
	return value, err == nil, err
}

type ConnectorStore struct{ db *gorm.DB }

func NewConnectorStore(db *gorm.DB) *ConnectorStore { return &ConnectorStore{db: db} }
func (s *ConnectorStore) PutChannel(ctx context.Context, value domain.ConnectorChannel) error {
	return s.db.WithContext(ctx).Save(&value).Error
}
func (s *ConnectorStore) GetChannel(ctx context.Context, id string) (domain.ConnectorChannel, bool, error) {
	var value domain.ConnectorChannel
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.ConnectorChannel{}, false, nil
	}
	return value, err == nil, err
}
func (s *ConnectorStore) ConsumeNonce(ctx context.Context, value domain.DelegationNonce) (bool, error) {
	err := s.db.WithContext(ctx).Create(&value).Error
	if err == nil {
		return true, nil
	}
	if isDuplicate(err) {
		return false, nil
	}
	return false, err
}
func (s *ConnectorStore) PutKeySet(ctx context.Context, value domain.DelegationKeySet) error {
	if len(value.KeysJSON) == 0 {
		value.KeysJSON, _ = json.Marshal(value.Keys)
	}
	return s.db.WithContext(ctx).Create(&value).Error
}
func (s *ConnectorStore) LatestKeySet(ctx context.Context, purpose string) (domain.DelegationKeySet, bool, error) {
	var value domain.DelegationKeySet
	err := s.db.WithContext(ctx).Where("purpose = ?", purpose).Order("version DESC").First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.DelegationKeySet{}, false, nil
	}
	if err == nil {
		_ = json.Unmarshal(value.KeysJSON, &value.Keys)
	}
	return value, err == nil, err
}
func (s *ConnectorStore) PutKeySetAck(ctx context.Context, value domain.DelegationKeySetAck) error {
	return s.db.WithContext(ctx).Save(&value).Error
}
func (s *ConnectorStore) GetPolicyProjection(ctx context.Context, enterpriseID, instanceID string) (domain.PolicyProjection, bool, error) {
	return getPolicyProjection(ctx, s.db, enterpriseID, instanceID)
}
func (s *ConnectorStore) PollLifecycle(ctx context.Context, enterpriseID, cursor string, limit int) ([]domain.PrincipalLifecycle, string, error) {
	if limit <= 0 || limit > 100 {
		limit = 100
	}
	query := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID)
	if cursor != "" {
		query = query.Where("id > ?", cursor)
	}
	var values []domain.PrincipalLifecycle
	if err := query.Order("id ASC").Limit(limit).Find(&values).Error; err != nil {
		return nil, "", err
	}
	next := ""
	if len(values) == limit {
		next = values[len(values)-1].ID
	}
	return values, next, nil
}

func isDuplicate(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return containsText(message, "duplicate key") || containsText(message, "Duplicate entry") || containsText(message, "UNIQUE constraint")
}
func containsText(value, wanted string) bool {
	for index := 0; index+len(wanted) <= len(value); index++ {
		if value[index:index+len(wanted)] == wanted {
			return true
		}
	}
	return false
}
