package domain

import "time"

const (
	GroupManagedByECP       = "ecp_managed"
	GroupManagedByDirectory = "directory_managed"
)

type IdentityGroup struct {
	Base
	Provider            string `gorm:"column:provider;type:varchar(128);not null"`
	ExternalID          string `gorm:"column:external_id;type:varchar(255);not null"`
	Name                string `gorm:"column:name;type:varchar(255);not null"`
	ManagementMode      string `gorm:"column:management_mode;type:varchar(32);not null"`
	DirectMemberVersion uint64 `gorm:"column:direct_member_version;not null"`
	Status              string `gorm:"column:status;type:varchar(32);not null"`
}

func (IdentityGroup) TableName() string { return "identity_groups" }

type DirectGroupMembership struct {
	EnterpriseID string    `gorm:"column:enterprise_id;type:varchar(36);primaryKey"`
	GroupID      string    `gorm:"column:group_id;type:varchar(36);primaryKey"`
	PrincipalID  string    `gorm:"column:principal_id;type:varchar(36);primaryKey"`
	CreatedAt    time.Time `gorm:"column:created_at;precision:6;not null"`
}

func (DirectGroupMembership) TableName() string { return "direct_group_memberships" }
