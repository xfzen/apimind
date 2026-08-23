package domain

import "time"

type BackupOperation struct {
	Base
	BackupID      string     `gorm:"column:backup_id;type:varchar(64);not null"`
	State         string     `gorm:"column:state;type:varchar(32);not null"`
	ManifestHash  string     `gorm:"column:manifest_hash;type:char(64);not null"`
	FailureReason string     `gorm:"column:failure_reason;type:text;not null"`
	StartedAt     time.Time  `gorm:"column:started_at;precision:6;not null"`
	CompletedAt   *time.Time `gorm:"column:completed_at;precision:6"`
	VerifiedAt    *time.Time `gorm:"column:verified_at;precision:6"`
}

func (BackupOperation) TableName() string { return "backup_operations" }
