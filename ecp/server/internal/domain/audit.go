package domain

import "time"

const (
	AuditStageIntent    = "intent"
	AuditStageCommitted = "change_committed"
	AuditStageOutcome   = "outcome"
	AuditStageProduct   = "product_event"
)

type AuditEvent struct {
	Sequence              uint64    `gorm:"column:sequence;primaryKey;autoIncrement"`
	ID                    string    `gorm:"column:id;type:varchar(36);not null;uniqueIndex"`
	EnterpriseID          string    `gorm:"column:enterprise_id;type:varchar(36);not null;index"`
	ApplicationInstanceID string    `gorm:"column:application_instance_id;type:varchar(36);not null;index"`
	OperationID           string    `gorm:"column:operation_id;type:varchar(128);not null;index"`
	Stage                 string    `gorm:"column:stage;type:varchar(32);not null"`
	ActorID               string    `gorm:"column:actor_id;type:varchar(64);not null"`
	ActorKind             string    `gorm:"column:actor_kind;type:varchar(32);not null"`
	Action                string    `gorm:"column:action;type:varchar(128);not null"`
	ResourceType          string    `gorm:"column:resource_type;type:varchar(64);not null"`
	ResourceID            string    `gorm:"column:resource_id;type:varchar(255);not null"`
	Outcome               string    `gorm:"column:outcome;type:varchar(32);not null"`
	Reason                string    `gorm:"column:reason;type:varchar(128);not null"`
	SafeDiff              []byte    `gorm:"column:safe_diff;type:text;not null"`
	OccurredAt            time.Time `gorm:"column:occurred_at;precision:6;not null"`
	CreatedAt             time.Time `gorm:"column:created_at;precision:6;not null"`
}

func (AuditEvent) TableName() string { return "audit_event" }

type AuditArchive struct {
	ID            string     `gorm:"column:id;type:varchar(36);primaryKey"`
	SequenceStart uint64     `gorm:"column:sequence_start;not null"`
	SequenceEnd   uint64     `gorm:"column:sequence_end;not null"`
	EventCount    uint64     `gorm:"column:event_count;not null"`
	CanonicalHash string     `gorm:"column:canonical_hash;type:char(64);not null"`
	Manifest      []byte     `gorm:"column:manifest;type:text;not null"`
	VerifiedAt    *time.Time `gorm:"column:verified_at;precision:6"`
	CreatedAt     time.Time  `gorm:"column:created_at;precision:6;not null"`
}

func (AuditArchive) TableName() string { return "audit_archive" }
