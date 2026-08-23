package domain

type Application struct {
	Base
	Key     string `gorm:"column:application_key;type:varchar(64);not null"`
	Name    string `gorm:"column:name;type:varchar(128);not null"`
	Status  string `gorm:"column:status;type:varchar(32);not null"`
	Version uint64 `gorm:"column:version;not null"`
}

func (Application) TableName() string { return "applications" }

type ApplicationInstance struct {
	Base
	ApplicationID string `gorm:"column:application_id;type:varchar(36);not null"`
	InstanceKey   string `gorm:"column:instance_key;type:varchar(64);not null"`
	Environment   string `gorm:"column:environment;type:varchar(32);not null"`
	CanonicalURL  string `gorm:"column:canonical_url;type:varchar(512);not null"`
	Status        string `gorm:"column:status;type:varchar(32);not null"`
	Version       uint64 `gorm:"column:version;not null"`
}

func (ApplicationInstance) TableName() string { return "application_instances" }
