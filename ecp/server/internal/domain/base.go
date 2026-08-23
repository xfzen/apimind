package domain

import "time"

type Base struct {
	ID           string    `gorm:"column:id;type:varchar(36);primaryKey"`
	EnterpriseID string    `gorm:"column:enterprise_id;type:varchar(36);not null;index"`
	CreatedAt    time.Time `gorm:"column:created_at;precision:6;not null"`
	UpdatedAt    time.Time `gorm:"column:updated_at;precision:6;not null"`
}
