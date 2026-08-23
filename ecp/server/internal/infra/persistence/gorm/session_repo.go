package persistence

import (
	"context"
	"errors"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SessionStore struct{ db *gorm.DB }

func NewSessionStore(db *gorm.DB) *SessionStore { return &SessionStore{db: db} }
func (s *SessionStore) CreateLoginTransaction(ctx context.Context, value domain.LoginTransaction) error {
	return s.db.WithContext(ctx).Create(&value).Error
}
func (s *SessionStore) GetLoginTransaction(ctx context.Context, id string) (domain.LoginTransaction, bool, error) {
	var value domain.LoginTransaction
	err := s.db.WithContext(ctx).Where("id = ?", id).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.LoginTransaction{}, false, nil
	}
	return value, err == nil, err
}
func (s *SessionStore) MarkLoginTransactionUsed(ctx context.Context, id string, usedAt time.Time) (bool, error) {
	result := s.db.WithContext(ctx).Model(&domain.LoginTransaction{}).Where("id = ? AND used_at IS NULL", id).Updates(map[string]any{"used_at": usedAt, "updated_at": usedAt})
	return result.RowsAffected == 1, result.Error
}
func (s *SessionStore) CreateProductTransaction(ctx context.Context, value domain.ProductLoginTransaction) error {
	return s.db.WithContext(ctx).Create(&value).Error
}
func (s *SessionStore) ConsumeProductTransaction(ctx context.Context, codeHash string, usedAt time.Time) (domain.ProductLoginTransaction, bool, error) {
	var consumed domain.ProductLoginTransaction
	err := WithTx(ctx, s.db, func(tx *gorm.DB) error {
		var value domain.ProductLoginTransaction
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("code_hash = ? AND used_at IS NULL", codeHash).First(&value).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		if err := tx.Model(&value).Updates(map[string]any{"used_at": usedAt, "updated_at": usedAt}).Error; err != nil {
			return err
		}
		value.UsedAt = &usedAt
		consumed = value
		return nil
	})
	return consumed, consumed.ID != "", err
}
func (s *SessionStore) CreateSession(ctx context.Context, value domain.Session) error {
	return s.db.WithContext(ctx).Omit("Token", "CSRFToken", "CookieName").Create(&value).Error
}
func (s *SessionStore) GetSessionByTokenHash(ctx context.Context, tokenHash string) (domain.Session, bool, error) {
	var value domain.Session
	err := s.db.WithContext(ctx).Where("token_hash = ?", tokenHash).First(&value).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.Session{}, false, nil
	}
	return value, err == nil, err
}
func (s *SessionStore) ListSessions(ctx context.Context, enterpriseID string) ([]domain.Session, error) {
	var values []domain.Session
	err := s.db.WithContext(ctx).Where("enterprise_id = ?", enterpriseID).Order("created_at DESC").Find(&values).Error
	return values, err
}
func (s *SessionStore) RevokeSession(ctx context.Context, enterpriseID, id string, revokedAt time.Time) (bool, error) {
	result := s.db.WithContext(ctx).Model(&domain.Session{}).Where("enterprise_id = ? AND id = ? AND revoked_at IS NULL", enterpriseID, id).Updates(map[string]any{"revoked_at": revokedAt, "updated_at": revokedAt, "version": gorm.Expr("version + ?", 1)})
	return result.RowsAffected == 1, result.Error
}
func (s *SessionStore) RevokePrincipalSessions(ctx context.Context, enterpriseID, principalID string, revokedAt time.Time) (int64, error) {
	result := s.db.WithContext(ctx).Model(&domain.Session{}).Where("enterprise_id = ? AND principal_id = ? AND revoked_at IS NULL", enterpriseID, principalID).Updates(map[string]any{"revoked_at": revokedAt, "updated_at": revokedAt, "version": gorm.Expr("version + ?", 1)})
	return result.RowsAffected, result.Error
}
