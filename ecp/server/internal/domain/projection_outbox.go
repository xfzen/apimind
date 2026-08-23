package domain

type ProjectionOutbox struct {
	Base
	ApplicationInstanceID string `gorm:"column:application_instance_id;type:varchar(36);not null"`
	OperationID           string `gorm:"column:operation_id;type:varchar(128);not null"`
	ProjectionType        string `gorm:"column:projection_type;type:varchar(64);not null"`
	Payload               []byte `gorm:"column:payload;type:text;not null"`
	State                 string `gorm:"column:state;type:varchar(32);not null"`
	Attempts              uint64 `gorm:"column:attempts;not null"`
	LastError             string `gorm:"column:last_error;type:text;not null"`
}

func (ProjectionOutbox) TableName() string { return "projection_outbox" }
