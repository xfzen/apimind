package domain

import "time"

type IdempotencyRecord struct {
	Base
	OperationID      string    `gorm:"column:operation_id;type:varchar(128);not null"`
	IdempotencyKey   string    `gorm:"column:idempotency_key;type:varchar(128);not null"`
	Method           string    `gorm:"column:method;type:varchar(16);not null"`
	CanonicalPath    string    `gorm:"column:canonical_path;type:varchar(512);not null"`
	RequestHash      string    `gorm:"column:request_hash;type:char(64);not null"`
	ResponseStatus   int       `gorm:"column:response_status;not null"`
	ResponseBodyHash string    `gorm:"column:response_body_hash;type:char(64);not null"`
	State            string    `gorm:"column:state;type:varchar(32);not null"`
	ExpiresAt        time.Time `gorm:"column:expires_at;precision:6;not null"`
}

func (IdempotencyRecord) TableName() string { return "idempotency_records" }
