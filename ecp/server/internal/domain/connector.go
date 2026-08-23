package domain

type Connector struct {
	Base
	ApplicationID string `gorm:"column:application_id;type:varchar(36);not null"`
	InstanceID    string `gorm:"column:instance_id;type:varchar(36);not null"`
	ConnectorKey  string `gorm:"column:connector_key;type:varchar(64);not null"`
	Status        string `gorm:"column:status;type:varchar(32);not null"`
	Version       uint64 `gorm:"column:version;not null"`
}

func (Connector) TableName() string { return "connectors" }
