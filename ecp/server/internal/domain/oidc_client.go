package domain

import "time"

type OIDCClient struct {
	Base
	ApplicationID   string     `gorm:"column:application_id;type:varchar(36);not null"`
	InstanceID      string     `gorm:"column:instance_id;type:varchar(36);not null"`
	ClientID        string     `gorm:"column:client_id;type:varchar(128);not null"`
	SecretReference string     `gorm:"column:secret_reference;type:varchar(512);not null"`
	RedirectURIs    []string   `gorm:"column:redirect_uris;type:text;serializer:json;not null"`
	Status          string     `gorm:"column:status;type:varchar(32);not null"`
	Version         uint64     `gorm:"column:version;not null"`
	DisabledAt      *time.Time `gorm:"column:disabled_at;precision:6"`
}

func (OIDCClient) TableName() string { return "oidc_clients" }
