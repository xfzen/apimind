package domain

type RoleBinding struct {
	Base
	ApplicationInstanceID string `gorm:"column:application_instance_id;type:varchar(36);not null"`
	SubjectType           string `gorm:"column:subject_type;type:varchar(16);not null"`
	SubjectID             string `gorm:"column:subject_id;type:varchar(36);not null"`
	RoleID                string `gorm:"column:role_id;type:varchar(128);not null"`
	ResourceType          string `gorm:"column:resource_type;type:varchar(64);not null"`
	ResourceID            string `gorm:"column:resource_id;type:varchar(255);not null"`
	Status                string `gorm:"column:status;type:varchar(32);not null"`
	Version               uint64 `gorm:"column:version;not null"`
}

func (RoleBinding) TableName() string { return "role_bindings" }
