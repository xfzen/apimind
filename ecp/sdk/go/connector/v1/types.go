package connectorv1

import "time"

const (
	ManifestSchemaV1 = "connector.manifest/v1"
	DelegationTypeV1 = "ecp.delegation/v1"
)

type Manifest struct {
	SchemaVersion string               `json:"schema_version"`
	Product       string               `json:"product"`
	InstanceID    string               `json:"instance_id"`
	MinECPVersion string               `json:"min_ecp_version"`
	Capabilities  []string             `json:"capabilities"`
	Resources     []ResourceCapability `json:"resources"`
}

type ResourceCapability struct {
	Type    string   `json:"type"`
	Actions []string `json:"actions"`
}

type Delegation struct {
	Type          string    `json:"type"`
	Issuer        string    `json:"iss"`
	Audience      string    `json:"aud"`
	Subject       string    `json:"sub"`
	EnterpriseID  string    `json:"enterprise_id"`
	ApplicationID string    `json:"application_id"`
	InstanceID    string    `json:"instance_id"`
	ResourceType  string    `json:"resource_type"`
	ResourceID    string    `json:"resource_id"`
	Actions       []string  `json:"actions"`
	IssuedAt      time.Time `json:"issued_at"`
	ExpiresAt     time.Time `json:"expires_at"`
	Nonce         string    `json:"nonce"`
	KeyID         string    `json:"kid"`
}

type SignedDelegation struct {
	Payload   []byte `json:"payload"`
	Signature string `json:"signature"`
}

type Health struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}
