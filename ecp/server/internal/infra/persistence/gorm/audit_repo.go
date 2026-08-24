package persistence

import (
	"context"
	"fmt"

	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
	"gorm.io/gorm"
)

type AuditAppendStore struct{ db *gorm.DB }

func NewAuditAppendStore(db *gorm.DB) *AuditAppendStore { return &AuditAppendStore{db: db} }
func (s *AuditAppendStore) Append(ctx context.Context, value domain.AuditEvent) error {
	return appendAuditEvent(s.db.WithContext(ctx), value, false)
}
func (s *AuditAppendStore) AppendOnce(ctx context.Context, value domain.AuditEvent) error {
	return appendAuditEvent(s.db.WithContext(ctx), value, true)
}

type AuditTransactionStore struct{ db *gorm.DB }

func NewAuditTransactionStore(db *gorm.DB) *AuditTransactionStore {
	return &AuditTransactionStore{db: db}
}
func (s *AuditTransactionStore) Commit(ctx context.Context, event domain.AuditEvent, mutation func(*gorm.DB) error) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := mutation(tx); err != nil {
			return err
		}
		return appendAuditEvent(tx, event, false)
	})
}

var auditEventColumns = "(id,enterprise_id,application_instance_id,operation_id,stage,actor_id,actor_kind,action,resource_type,resource_id,outcome,reason,safe_diff,occurred_at,created_at)"

func appendAuditEvent(db *gorm.DB, value domain.AuditEvent, once bool) error {
	if db == nil {
		return fmt.Errorf("audit append store unavailable")
	}
	statement, err := auditInsertStatement(db.Dialector.Name(), once)
	if err != nil {
		return err
	}
	return db.Exec(statement, value.ID, value.EnterpriseID, value.ApplicationInstanceID, value.OperationID, value.Stage, value.ActorID, value.ActorKind, value.Action, value.ResourceType, value.ResourceID, value.Outcome, value.Reason, value.SafeDiff, value.OccurredAt, value.CreatedAt).Error
}

func auditInsertStatement(dialect string, once bool) (string, error) {
	prefix := "INSERT INTO audit_event "
	suffix := ""
	if once {
		switch dialect {
		case "postgres":
			suffix = " ON CONFLICT (id) DO NOTHING"
		case "mysql":
			prefix = "INSERT IGNORE INTO audit_event "
		default:
			return "", fmt.Errorf("unsupported audit dialect %q", dialect)
		}
	}
	return prefix + auditEventColumns + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)" + suffix, nil
}

type AuditReadStore struct{ db *gorm.DB }

func NewAuditReadStore(db *gorm.DB) *AuditReadStore { return &AuditReadStore{db: db} }
func (s *AuditReadStore) Query(ctx context.Context, query auditservice.Query) ([]domain.AuditEvent, error) {
	db := s.db.WithContext(ctx).Where("enterprise_id = ?", query.EnterpriseID)
	if query.ApplicationInstanceID != "" {
		db = db.Where("application_instance_id = ?", query.ApplicationInstanceID)
	}
	if query.OperationID != "" {
		db = db.Where("operation_id = ?", query.OperationID)
	}
	if query.SequenceAfter != 0 {
		db = db.Where("sequence > ?", query.SequenceAfter)
	}
	var values []domain.AuditEvent
	err := db.Order("sequence ASC").Limit(query.Limit).Find(&values).Error
	return values, err
}

type AuditArchiveStore struct{ db *gorm.DB }

func NewAuditArchiveStore(db *gorm.DB) *AuditArchiveStore { return &AuditArchiveStore{db: db} }
func (s *AuditArchiveStore) ReadRange(ctx context.Context, before uint64, limit int) ([]domain.AuditEvent, error) {
	var values []domain.AuditEvent
	err := s.db.WithContext(ctx).Where("sequence <= ?", before).Order("sequence ASC").Limit(limit).Find(&values).Error
	return values, err
}
func (s *AuditArchiveStore) PersistVerifiedAndDelete(ctx context.Context, archive domain.AuditArchive) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if archive.VerifiedAt == nil {
			return gorm.ErrInvalidData
		}
		if err := tx.Create(&archive).Error; err != nil {
			return err
		}
		return tx.Where("sequence >= ? AND sequence <= ?", archive.SequenceStart, archive.SequenceEnd).Delete(&domain.AuditEvent{}).Error
	})
}
