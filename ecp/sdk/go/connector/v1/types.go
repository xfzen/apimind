package connectorv1

import (
	"context"
	"time"
)

const (
	ManifestSchemaV1         = "connector.manifest/v1"
	DelegationTypeV1         = "ecp.delegation/v1"
	AlgorithmEdDSA           = "EdDSA"
	DelegationPurposeProduct = "product.operation"
	KeySetPurposeDelegation  = "delegation"
	KeyStatusPending         = "pending"
	KeyStatusActive          = "active"
	KeyStatusRetiring        = "retiring"
	KeyStatusRevoked         = "revoked"
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
	Type                      string    `json:"type"`
	Algorithm                 string    `json:"alg"`
	Issuer                    string    `json:"iss"`
	Audience                  string    `json:"aud"`
	Subject                   string    `json:"sub"`
	EnterpriseID              string    `json:"enterprise_id"`
	ApplicationID             string    `json:"application_id"`
	InstanceID                string    `json:"instance_id"`
	ResourceType              string    `json:"resource_type"`
	ResourceID                string    `json:"resource_id"`
	Actions                   []string  `json:"actions"`
	ActorPrincipalID          string    `json:"actor_principal_id"`
	AdminSessionID            string    `json:"admin_session_id,omitempty"`
	RequestedAction           string    `json:"requested_action"`
	Purpose                   string    `json:"purpose"`
	OperationID               string    `json:"operation_id"`
	IssuedAt                  time.Time `json:"issued_at"`
	ExpiresAt                 time.Time `json:"expires_at"`
	PolicyVersion             uint64    `json:"policy_version"`
	LifecycleVersion          uint64    `json:"lifecycle_version"`
	IdentitySyncVersion       uint64    `json:"identity_sync_version"`
	IdentityFreshnessDeadline time.Time `json:"identity_freshness_deadline,omitempty"`
	Nonce                     string    `json:"nonce"`
	KeyID                     string    `json:"kid"`
}

type SignedDelegation struct {
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid"`
	Payload   []byte `json:"payload"`
	Signature string `json:"signature"`
}

type VerificationKey struct {
	KeyID     string    `json:"kid"`
	Algorithm string    `json:"alg"`
	PublicKey []byte    `json:"public_key"`
	NotBefore time.Time `json:"not_before"`
	NotAfter  time.Time `json:"not_after"`
	Status    string    `json:"status"`
}

type KeySet struct {
	Version             uint64            `json:"version"`
	Purpose             string            `json:"purpose"`
	PreviousVersion     uint64            `json:"previous_version"`
	PreviousFingerprint string            `json:"previous_fingerprint"`
	Keys                []VerificationKey `json:"keys"`
	PayloadHash         string            `json:"payload_hash"`
	SigningKeyID        string            `json:"signing_kid"`
	Fingerprint         string            `json:"-"`
}

type SignedKeySet struct {
	Algorithm    string `json:"alg"`
	SigningKeyID string `json:"signing_kid"`
	Payload      []byte `json:"payload"`
	Signature    string `json:"signature"`
}

type ConnectorClaims struct {
	ConnectorID   string   `json:"connector_id"`
	EnterpriseID  string   `json:"enterprise_id"`
	ApplicationID string   `json:"application_id"`
	InstanceID    string   `json:"instance_id"`
	Audience      string   `json:"audience"`
	Scopes        []string `json:"scopes"`
}

type ResourceReference struct {
	Type        string             `json:"type"`
	ID          string             `json:"id"`
	Version     uint64             `json:"version"`
	DisplayName string             `json:"display_name,omitempty"`
	Parent      *ResourceReference `json:"parent,omitempty"`
}

type StableDenial struct {
	Reason string `json:"reason"`
}

type Health struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

type ConnectorCredential struct {
	ConnectorID string
	Secret      string
}
type InstanceRegistration struct{ EnterpriseID, ApplicationID, InstanceID, ConnectorKey, CanonicalURL string }
type InstanceRegistrationResult struct {
	ConnectorID, RootFingerprint string
	KeySet                       SignedKeySet
}
type HeartbeatRequest struct {
	InstanceID, Version string
	ObservedAt          time.Time
}
type SessionResolutionRequest struct{ InstanceID, SessionToken string }
type SessionResolution struct {
	PrincipalID      string
	Revoked          bool
	ExpiresAt        time.Time
	LifecycleVersion uint64
}
type AuthorizationRequest struct {
	EnterpriseID, ApplicationInstanceID, PrincipalID, Action, ResourceID string
	ResourceVersion                                                      uint64
}
type AuthorizationDecision struct {
	Allow                                                                           bool
	Reason                                                                          string
	PolicyVersion, LifecycleVersion, IdentitySyncVersion, AuthorizedResourceVersion uint64
}
type AuditEvent struct {
	OperationID, Action, ResourceType, ResourceID, Outcome string
	OccurredAt                                             time.Time
	SafeDiff                                               map[string]string
}
type PolicyVersion struct {
	Version              uint64
	State, CanonicalHash string
}
type LifecycleCursor struct {
	Cursor string
	Limit  int
}
type LifecycleChange struct {
	PrincipalID, State string
	Version            uint64
}
type LifecycleChanges struct {
	Changes    []LifecycleChange
	NextCursor string
}
type KeySetAck struct {
	Version        uint64
	AcceptedKeyIDs []string
}

type ProductAPI interface {
	GetCapabilities(context.Context, SignedDelegation) ([]string, error)
	SearchResources(context.Context, SignedDelegation, string, string, int) ([]ResourceReference, error)
	ResolveResource(context.Context, SignedDelegation, string, string) (ResourceReference, error)
	GetResourceAncestry(context.Context, SignedDelegation, string, string) ([]ResourceReference, error)
	ApplyCompatibilityProjection(context.Context, SignedDelegation, []byte) error
	GetHealth(context.Context) (Health, error)
	GetVersion(context.Context) (string, error)
}
