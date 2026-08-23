package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"
)

const (
	AlgorithmEdDSA             = "EdDSA"
	DelegationTypeV1           = "ecp.delegation/v1"
	DelegationPurposeProduct   = "product.operation"
	KeySetPurposeDelegation    = "delegation"
	KeyStatusPending           = "pending"
	KeyStatusActive            = "active"
	KeyStatusRetiring          = "retiring"
	KeyStatusRevoked           = "revoked"
	TrustChannelInbound        = "product_to_ecp"
	TrustChannelOutbound       = "ecp_to_product"
	TrustChannelKeySetOperator = "keyset_operator"
)

type Delegation struct {
	Type                      string    `json:"type"`
	Algorithm                 string    `json:"alg"`
	Issuer                    string    `json:"iss"`
	Audience                  string    `json:"aud"`
	EnterpriseID              string    `json:"enterprise_id"`
	ApplicationID             string    `json:"application_id"`
	InstanceID                string    `json:"instance_id"`
	ActorPrincipalID          string    `json:"actor_principal_id"`
	AdminSessionID            string    `json:"admin_session_id,omitempty"`
	RequestedAction           string    `json:"requested_action"`
	Purpose                   string    `json:"purpose"`
	OperationID               string    `json:"operation_id"`
	Nonce                     string    `json:"nonce"`
	IssuedAt                  time.Time `json:"issued_at"`
	ExpiresAt                 time.Time `json:"expires_at"`
	PolicyVersion             uint64    `json:"policy_version"`
	LifecycleVersion          uint64    `json:"lifecycle_version"`
	IdentitySyncVersion       uint64    `json:"identity_sync_version"`
	IdentityFreshnessDeadline time.Time `json:"identity_freshness_deadline,omitempty"`
	KeyID                     string    `json:"kid"`
}

type SignedDelegation struct {
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid"`
	Payload   []byte `json:"payload"`
	Signature string `json:"signature"`
}

type DelegationNonce struct {
	ID        string    `gorm:"column:id;type:varchar(64);primaryKey"`
	Issuer    string    `gorm:"column:issuer;type:varchar(255);not null"`
	Audience  string    `gorm:"column:audience;type:varchar(128);not null"`
	Purpose   string    `gorm:"column:purpose;type:varchar(64);not null"`
	Nonce     string    `gorm:"column:nonce;type:varchar(128);not null"`
	ExpiresAt time.Time `gorm:"column:expires_at;precision:6;not null"`
	CreatedAt time.Time `gorm:"column:created_at;precision:6;not null"`
}

func (DelegationNonce) TableName() string { return "delegation_nonces" }

type DelegationVerificationKey struct {
	KeyID     string    `json:"kid"`
	Algorithm string    `json:"alg"`
	PublicKey string    `json:"public_key"`
	NotBefore time.Time `json:"not_before"`
	NotAfter  time.Time `json:"not_after"`
	Status    string    `json:"status"`
}

type DelegationKeySet struct {
	ID                  string                      `gorm:"column:id;type:varchar(64);primaryKey" json:"-"`
	Version             uint64                      `gorm:"column:version;not null" json:"version"`
	Purpose             string                      `gorm:"column:purpose;type:varchar(64);not null" json:"purpose"`
	PreviousVersion     uint64                      `gorm:"column:previous_version;not null" json:"previous_version"`
	PreviousFingerprint string                      `gorm:"column:previous_fingerprint;type:varchar(64);not null" json:"previous_fingerprint"`
	Keys                []DelegationVerificationKey `gorm:"-" json:"keys"`
	KeysJSON            []byte                      `gorm:"column:keys_json;type:text;not null" json:"-"`
	PayloadHash         string                      `gorm:"column:payload_hash;type:varchar(64);not null" json:"payload_hash"`
	SigningKeyID        string                      `gorm:"column:signing_kid;type:varchar(128);not null" json:"signing_kid"`
	RootSignature       string                      `gorm:"column:root_signature;type:text;not null" json:"root_signature"`
	Fingerprint         string                      `gorm:"column:fingerprint;type:varchar(64);not null" json:"fingerprint"`
	CreatedAt           time.Time                   `gorm:"column:created_at;precision:6;not null" json:"created_at"`
}

func (DelegationKeySet) TableName() string { return "delegation_keysets" }

type DelegationKeySetAck struct {
	ID                 string    `gorm:"column:id;type:varchar(64);primaryKey"`
	ConnectorID        string    `gorm:"column:connector_id;type:varchar(36);not null"`
	InstanceID         string    `gorm:"column:instance_id;type:varchar(36);not null"`
	Version            uint64    `gorm:"column:version;not null"`
	AcceptedKeyIDsJSON []byte    `gorm:"column:accepted_key_ids;type:text;not null"`
	AcknowledgedAt     time.Time `gorm:"column:acknowledged_at;precision:6;not null"`
}

func (DelegationKeySetAck) TableName() string { return "delegation_keyset_acks" }

type ConnectorChannel struct {
	ID              string    `gorm:"column:id;type:varchar(64);primaryKey"`
	EnterpriseID    string    `gorm:"column:enterprise_id;type:varchar(36);not null"`
	ApplicationID   string    `gorm:"column:application_id;type:varchar(36);not null"`
	InstanceID      string    `gorm:"column:instance_id;type:varchar(36);not null"`
	Channel         string    `gorm:"column:channel;type:varchar(32);not null"`
	Audience        string    `gorm:"column:audience;type:varchar(128);not null"`
	ScopesJSON      []byte    `gorm:"column:scopes;type:text;not null"`
	SecretDigest    string    `gorm:"column:secret_digest;type:char(64);not null"`
	RotationLineage string    `gorm:"column:rotation_lineage;type:varchar(64);not null"`
	Status          string    `gorm:"column:status;type:varchar(32);not null"`
	ExpiresAt       time.Time `gorm:"column:expires_at;precision:6;not null"`
	CreatedAt       time.Time `gorm:"column:created_at;precision:6;not null"`
	UpdatedAt       time.Time `gorm:"column:updated_at;precision:6;not null"`
}

func (ConnectorChannel) TableName() string { return "connector_channels" }

func NewConnectorChannel(id, enterpriseID, applicationID, instanceID, channel string, scopes []string, rawSecret string, expiresAt time.Time) ConnectorChannel {
	now := time.Now().UTC()
	digest := sha256.Sum256([]byte(rawSecret))
	scopesJSON, _ := json.Marshal(scopes)
	return ConnectorChannel{ID: id, EnterpriseID: enterpriseID, ApplicationID: applicationID, InstanceID: instanceID, Channel: channel, Audience: instanceID, ScopesJSON: scopesJSON, SecretDigest: hex.EncodeToString(digest[:]), RotationLineage: id, Status: "active", ExpiresAt: expiresAt, CreatedAt: now, UpdatedAt: now}
}
