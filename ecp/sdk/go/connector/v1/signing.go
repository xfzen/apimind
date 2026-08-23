package connectorv1

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
)

var ErrInvalidSignature = errors.New("invalid delegation signature")

func SignDelegation(privateKey ed25519.PrivateKey, delegation Delegation) (SignedDelegation, error) {
	if len(privateKey) != ed25519.PrivateKeySize {
		return SignedDelegation{}, fmt.Errorf("private key length: %w", ErrInvalidSignature)
	}
	if delegation.Type == "" {
		delegation.Type = DelegationTypeV1
	}
	payload, err := json.Marshal(delegation)
	if err != nil {
		return SignedDelegation{}, fmt.Errorf("marshal delegation: %w", err)
	}
	signature := ed25519.Sign(privateKey, payload)
	return SignedDelegation{Payload: payload, Signature: base64.RawURLEncoding.EncodeToString(signature)}, nil
}

func VerifyDelegation(publicKey ed25519.PublicKey, signed SignedDelegation) (Delegation, error) {
	if len(publicKey) != ed25519.PublicKeySize {
		return Delegation{}, fmt.Errorf("public key length: %w", ErrInvalidSignature)
	}
	signature, err := base64.RawURLEncoding.DecodeString(signed.Signature)
	if err != nil || !ed25519.Verify(publicKey, signed.Payload, signature) {
		return Delegation{}, ErrInvalidSignature
	}
	var delegation Delegation
	if err := json.Unmarshal(signed.Payload, &delegation); err != nil {
		return Delegation{}, fmt.Errorf("decode delegation: %w", err)
	}
	if delegation.Type != DelegationTypeV1 {
		return Delegation{}, fmt.Errorf("delegation type %q: %w", delegation.Type, ErrInvalidSignature)
	}
	return delegation, nil
}
