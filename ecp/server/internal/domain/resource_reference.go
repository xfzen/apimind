package domain

import "time"

type ResourceReference struct {
	Base
	ApplicationInstanceID string    `gorm:"column:application_instance_id;type:varchar(36);not null"`
	ResourceType          string    `gorm:"column:resource_type;type:varchar(64);not null"`
	ExternalID            string    `gorm:"column:external_id;type:varchar(255);not null"`
	ParentExternalID      string    `gorm:"column:parent_external_id;type:varchar(255);not null"`
	DisplayName           string    `gorm:"column:display_name;type:varchar(255);not null"`
	ResourceVersion       uint64    `gorm:"column:resource_version;not null"`
	Visible               bool      `gorm:"column:visible;not null"`
	LastSeenAt            time.Time `gorm:"column:last_seen_at;precision:6;not null"`
}

func (ResourceReference) TableName() string { return "resource_references" }
