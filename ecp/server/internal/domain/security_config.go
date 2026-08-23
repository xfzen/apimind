package domain

type SecurityConfig struct {
	Base
	ApplicationInstanceID string `gorm:"column:application_instance_id;type:varchar(36);not null"`
	PublicSharing         bool   `gorm:"column:public_sharing;not null"`
	ExportEnabled         bool   `gorm:"column:export_enabled;not null"`
	SecretExport          bool   `gorm:"column:secret_export;not null"`
	Version               uint64 `gorm:"column:version;not null"`
}

func (SecurityConfig) TableName() string { return "security_configs" }
