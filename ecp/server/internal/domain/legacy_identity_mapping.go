package domain

import "time"

type LegacyIdentityMapping struct {
	ID            string    `gorm:"column:id;type:varchar(36);primaryKey"`
	EnterpriseID  string    `gorm:"column:enterprise_id;type:varchar(36);not null"`
	ApplicationID string    `gorm:"column:application_id;type:varchar(36);not null"`
	LegacySource  string    `gorm:"column:legacy_source;type:varchar(64);not null"`
	LegacySubject string    `gorm:"column:legacy_subject;type:varchar(255);not null"`
	PrincipalID   string    `gorm:"column:principal_id;type:varchar(36);not null"`
	CreatedAt     time.Time `gorm:"column:created_at;not null"`
}

func (LegacyIdentityMapping) TableName() string { return "legacy_identity_mappings" }
