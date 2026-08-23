package domain

import "time"

type CredentialScope struct {
	ResourceType string   `json:"resource_type"`
	ResourceID   string   `json:"resource_id"`
	Actions      []string `json:"actions"`
}

type ServiceCredential struct {
	Base
	ApplicationID         string     `gorm:"column:application_id;type:varchar(36);not null"`
	ApplicationInstanceID string     `gorm:"column:application_instance_id;type:varchar(36);not null"`
	Name                  string     `gorm:"column:name;type:varchar(128);not null"`
	SecretDigest          string     `gorm:"column:secret_digest;type:char(64);not null"`
	ScopesJSON            []byte     `gorm:"column:scopes;type:text;not null"`
	Status                string     `gorm:"column:status;type:varchar(32);not null"`
	RotationLineage       string     `gorm:"column:rotation_lineage;type:varchar(64);not null"`
	RotatedFromID         string     `gorm:"column:rotated_from_id;type:varchar(36);not null"`
	ExpiresAt             time.Time  `gorm:"column:expires_at;precision:6;not null"`
	OverlapUntil          *time.Time `gorm:"column:overlap_until;precision:6"`
	LastUsedAt            *time.Time `gorm:"column:last_used_at;precision:6"`
	RevokedAt             *time.Time `gorm:"column:revoked_at;precision:6"`
	Version               uint64     `gorm:"column:version;not null"`
}

func (ServiceCredential) TableName() string { return "service_credentials" }
