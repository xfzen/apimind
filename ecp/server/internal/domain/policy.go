package domain

type PolicyProjection struct {
	Base
	ApplicationInstanceID          string   `gorm:"column:application_instance_id;type:varchar(36);not null"`
	CasdoorPermissionID            string   `gorm:"column:casdoor_permission_id;type:varchar(255);not null"`
	CasdoorPolicyIDs               []string `gorm:"column:casdoor_policy_ids;type:text;serializer:json;not null"`
	NormalizedHash                 string   `gorm:"column:normalized_hash;type:char(64);not null"`
	ManifestVersion, PolicyVersion uint64
	ReconciliationState            string `gorm:"column:reconciliation_state;type:varchar(32);not null"`
	LastError                      string `gorm:"column:last_error;type:text;not null"`
}

func (PolicyProjection) TableName() string { return "policy_projections" }
