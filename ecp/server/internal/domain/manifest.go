package domain

type ProductManifest struct {
	Base
	ApplicationID string `gorm:"column:application_id;type:varchar(36);not null"`
	APIVersion    string `gorm:"column:api_version;type:varchar(64);not null"`
	ManifestHash  string `gorm:"column:manifest_hash;type:varchar(64);not null"`
	Body          []byte `gorm:"column:body;type:text;not null"`
	Version       uint64 `gorm:"column:version;not null"`
}

func (ProductManifest) TableName() string { return "product_manifests" }
