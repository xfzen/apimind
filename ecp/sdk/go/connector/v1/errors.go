package connectorv1

import "fmt"

type ErrorCode string

const (
	ErrorDenied               ErrorCode = "ECP_DENIED"
	ErrorUnavailable          ErrorCode = "ECP_UNAVAILABLE"
	ErrorStaleIdentity        ErrorCode = "ECP_STALE_IDENTITY"
	ErrorInvalidDelegation    ErrorCode = "ECP_INVALID_DELEGATION"
	ErrorManifestIncompatible ErrorCode = "ECP_MANIFEST_INCOMPATIBLE"
)

var (
	ErrInvalidSignature      = fmt.Errorf("invalid delegation signature")
	ErrAlgorithmMismatch     = fmt.Errorf("algorithm_mismatch")
	ErrAudienceMismatch      = fmt.Errorf("delegation_audience_mismatch")
	ErrPurposeMismatch       = fmt.Errorf("delegation_purpose_mismatch")
	ErrDelegationExpired     = fmt.Errorf("delegation_expired")
	ErrDelegationNotYetValid = fmt.Errorf("delegation_not_yet_valid")
	ErrDelegationReplay      = fmt.Errorf("delegation_replay")
	ErrDelegationLifetime    = fmt.Errorf("delegation_lifetime_exceeded")
	ErrDelegationFreshness   = fmt.Errorf("delegation_freshness_exceeded")
	ErrKeySetSignature       = fmt.Errorf("keyset_signature_invalid")
	ErrKeySetRollback        = fmt.Errorf("keyset_version_rollback")
	ErrKeySetChain           = fmt.Errorf("keyset_chain_invalid")
	ErrUnknownKey            = fmt.Errorf("delegation_unknown_kid")
)

type APIError struct {
	Code       ErrorCode `json:"code"`
	Message    string    `json:"message"`
	RequestID  string    `json:"request_id,omitempty"`
	StatusCode int       `json:"-"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}
