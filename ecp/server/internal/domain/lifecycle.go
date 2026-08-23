package domain

import "time"

const (
	LifecycleActive              = "active"
	LifecycleBlocked             = "blocked"
	LifecyclePendingExternalSync = "pending_external_sync"
)

type PrincipalLifecycle struct {
	Base
	PrincipalID string     `gorm:"column:principal_id;type:varchar(36);not null"`
	State       string     `gorm:"column:state;type:varchar(32);not null"`
	Version     uint64     `gorm:"column:version;not null"`
	BlockedAt   *time.Time `gorm:"column:blocked_at;precision:6"`
}

func (PrincipalLifecycle) TableName() string { return "principal_lifecycle" }

type IdentitySyncState struct {
	Base
	Provider           string     `gorm:"column:provider;type:varchar(128);not null"`
	Version            uint64     `gorm:"column:version;not null"`
	LastSuccessfulSync *time.Time `gorm:"column:last_successful_sync;precision:6"`
	FreshnessDeadline  *time.Time `gorm:"column:freshness_deadline;precision:6"`
	SourceCursor       string     `gorm:"column:source_cursor;type:varchar(512);not null"`
	State              string     `gorm:"column:state;type:varchar(32);not null"`
	LastError          string     `gorm:"column:last_error;type:text;not null"`
}

func (IdentitySyncState) TableName() string { return "identity_sync_states" }
