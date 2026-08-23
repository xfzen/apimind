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

type APIError struct {
	Code       ErrorCode `json:"code"`
	Message    string    `json:"message"`
	RequestID  string    `json:"request_id,omitempty"`
	StatusCode int       `json:"-"`
}

func (e *APIError) Error() string {
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}
