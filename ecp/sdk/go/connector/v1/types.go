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
type InstanceRegistration struct {
	EnterpriseID  string `json:"enterprise_id"`
	ApplicationID string `json:"application_id"`
	InstanceID    string `json:"instance_id"`
	ConnectorKey  string `json:"connector_key"`
	CanonicalURL  string `json:"canonical_url"`
}
type InstanceRegistrationResult struct {
	ConnectorID     string       `json:"connector_id"`
	RootFingerprint string       `json:"root_fingerprint"`
	KeySet          SignedKeySet `json:"delegation_key_set"`
}
type HeartbeatRequest struct {
	InstanceID string    `json:"instance_id"`
	Version    string    `json:"version"`
	ObservedAt time.Time `json:"observed_at"`
}
type SessionResolutionRequest struct {
	InstanceID   string `json:"instance_id"`
	SessionToken string `json:"session_token"`
}
type SessionRevocationRequest struct {
	InstanceID   string `json:"instance_id"`
	SessionToken string `json:"session_token"`
}
type SessionResolution struct {
	PrincipalID      string    `json:"principal_id"`
	Revoked          bool      `json:"revoked"`
	ExpiresAt        time.Time `json:"expires_at"`
	LifecycleVersion uint64    `json:"lifecycle_version"`
}
type AuthorizationRequest struct {
	EnterpriseID          string `json:"enterprise_id"`
	ApplicationInstanceID string `json:"application_instance_id"`
	PrincipalID           string `json:"principal_id"`
	Action                string `json:"action"`
	ResourceID            string `json:"resource_id"`
	ResourceVersion       uint64 `json:"resource_version"`
}
type AuthorizationDecision struct {
	Allow                     bool   `json:"allow"`
	Reason                    string `json:"reason"`
	PolicyVersion             uint64 `json:"policy_version"`
	LifecycleVersion          uint64 `json:"lifecycle_version"`
	IdentitySyncVersion       uint64 `json:"identity_sync_version"`
	AuthorizedResourceVersion uint64 `json:"authorized_resource_version"`
}
type ServiceCredentialAuthorizationRequest struct {
	Credential      string `json:"credential"`
	ResourceType    string `json:"resource_type"`
	ResourceID      string `json:"resource_id"`
	Action          string `json:"action"`
	ResourceVersion uint64 `json:"resource_version"`
}
type ServiceCredentialAuthorization struct {
	PrincipalID string                `json:"principal_id"`
	Decision    AuthorizationDecision `json:"decision"`
}
type AuditEvent struct {
	OperationID  string            `json:"operation_id"`
	Action       string            `json:"action"`
	ResourceType string            `json:"resource_type"`
	ResourceID   string            `json:"resource_id"`
	Outcome      string            `json:"outcome"`
	OccurredAt   time.Time         `json:"occurred_at"`
	SafeDiff     map[string]string `json:"safe_diff,omitempty"`
}
type PolicyVersion struct {
	Version       uint64 `json:"version"`
	State         string `json:"state"`
	CanonicalHash string `json:"canonical_hash"`
}
type LifecycleCursor struct {
	Cursor string `json:"cursor"`
	Limit  int    `json:"limit"`
}
type LifecycleChange struct {
	PrincipalID string `json:"principal_id"`
	State       string `json:"state"`
	Version     uint64 `json:"version"`
}
type LifecycleChanges struct {
	Changes    []LifecycleChange `json:"changes"`
	NextCursor string            `json:"next_cursor"`
}
type KeySetAck struct {
	Version        uint64   `json:"version"`
	AcceptedKeyIDs []string `json:"accepted_key_ids"`
}

type ProductLoginStartRequest struct {
	EnterpriseID          string `json:"enterprise_id"`
	ApplicationInstanceID string `json:"application_instance_id"`
	RedirectURI           string `json:"redirect_uri"`
}
type ProductLoginStart struct {
	TransactionID    string    `json:"transaction_id"`
	State            string    `json:"state"`
	PKCEVerifier     string    `json:"pkce_verifier"`
	Nonce            string    `json:"nonce"`
	AuthorizationURL string    `json:"authorization_url"`
	ExpiresAt        time.Time `json:"expires_at"`
}
type ProductLoginCompleteRequest struct {
	TransactionID string `json:"transaction_id"`
	State         string `json:"state"`
	PKCEVerifier  string `json:"pkce_verifier"`
	Nonce         string `json:"nonce"`
	Code          string `json:"code"`
}
type ProductLoginComplete struct {
	ExchangeCode string    `json:"exchange_code"`
	ExpiresAt    time.Time `json:"expires_at"`
}
type ProductLoginExchange struct {
	SessionToken string    `json:"session_token"`
	CSRFToken    string    `json:"csrf_token"`
	ExpiresAt    time.Time `json:"expires_at"`
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
