package connectorv1

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

const maximumDelegationLifetime = 60 * time.Second

func SignDelegation(privateKey ed25519.PrivateKey, delegation Delegation) (SignedDelegation, error) {
	if len(privateKey) != ed25519.PrivateKeySize {
		return SignedDelegation{}, fmt.Errorf("private key length: %w", ErrInvalidSignature)
	}
	if delegation.Type == "" {
		delegation.Type = DelegationTypeV1
	}
	if delegation.Algorithm == "" {
		delegation.Algorithm = AlgorithmEdDSA
	}
	if delegation.Purpose == "" {
		delegation.Purpose = DelegationPurposeProduct
	}
	if delegation.ActorPrincipalID == "" {
		delegation.ActorPrincipalID = delegation.Subject
	}
	if delegation.Subject == "" {
		delegation.Subject = delegation.ActorPrincipalID
	}
	if delegation.RequestedAction == "" && len(delegation.Actions) != 0 {
		delegation.RequestedAction = delegation.Actions[0]
	}
	if err := validateDelegation(delegation); err != nil {
		return SignedDelegation{}, err
	}
	payload, err := json.Marshal(delegation)
	if err != nil {
		return SignedDelegation{}, fmt.Errorf("marshal delegation: %w", err)
	}
	signature := ed25519.Sign(privateKey, payload)
	return SignedDelegation{Algorithm: AlgorithmEdDSA, KeyID: delegation.KeyID, Payload: payload, Signature: base64.RawURLEncoding.EncodeToString(signature)}, nil
}

func VerifyDelegation(publicKey ed25519.PublicKey, signed SignedDelegation) (Delegation, error) {
	if len(publicKey) != ed25519.PublicKeySize {
		return Delegation{}, fmt.Errorf("public key length: %w", ErrInvalidSignature)
	}
	if signed.Algorithm != "" && signed.Algorithm != AlgorithmEdDSA {
		return Delegation{}, ErrAlgorithmMismatch
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
	if delegation.Algorithm != AlgorithmEdDSA || (signed.KeyID != "" && signed.KeyID != delegation.KeyID) {
		return Delegation{}, ErrAlgorithmMismatch
	}
	return delegation, nil
}

type ReplayStore interface {
	CheckAndStore(key string, expiresAt time.Time) bool
}

type VerifyOptions struct {
	Audience  string
	Purpose   string
	Now       time.Time
	ClockSkew time.Duration
	Replay    ReplayStore
}

func VerifyDelegationFor(publicKey ed25519.PublicKey, signed SignedDelegation, options VerifyOptions) (Delegation, error) {
	delegation, err := VerifyDelegation(publicKey, signed)
	if err != nil {
		return Delegation{}, err
	}
	if err := validateDelegation(delegation); err != nil {
		return Delegation{}, err
	}
	if delegation.Audience != options.Audience {
		return Delegation{}, ErrAudienceMismatch
	}
	if delegation.Purpose != options.Purpose {
		return Delegation{}, ErrPurposeMismatch
	}
	now := options.Now.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}
	if now.Add(options.ClockSkew).Before(delegation.IssuedAt) {
		return Delegation{}, ErrDelegationNotYetValid
	}
	if !now.Add(-options.ClockSkew).Before(delegation.ExpiresAt) {
		return Delegation{}, ErrDelegationExpired
	}
	if options.Replay != nil {
		key := delegation.Issuer + "\x00" + delegation.Audience + "\x00" + delegation.Purpose + "\x00" + delegation.Nonce
		if !options.Replay.CheckAndStore(key, delegation.ExpiresAt.Add(options.ClockSkew)) {
			return Delegation{}, ErrDelegationReplay
		}
	}
	return delegation, nil
}

func validateDelegation(value Delegation) error {
	if value.Type != DelegationTypeV1 || value.Algorithm != AlgorithmEdDSA || value.Issuer == "" || value.Audience == "" || value.Subject == "" || value.Purpose == "" || value.Nonce == "" || value.KeyID == "" {
		return ErrInvalidSignature
	}
	if !value.ExpiresAt.After(value.IssuedAt) || value.ExpiresAt.Sub(value.IssuedAt) > maximumDelegationLifetime {
		return ErrDelegationLifetime
	}
	if !value.IdentityFreshnessDeadline.IsZero() && value.ExpiresAt.After(value.IdentityFreshnessDeadline) {
		return ErrDelegationFreshness
	}
	return nil
}

type memoryReplayStore struct {
	mu   sync.Mutex
	used map[string]time.Time
}

func NewMemoryReplayStore() ReplayStore { return &memoryReplayStore{used: make(map[string]time.Time)} }
func (s *memoryReplayStore) CheckAndStore(key string, expiresAt time.Time) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.used[key]; ok {
		return false
	}
	s.used[key] = expiresAt
	return true
}

func SignKeySet(rootPrivateKey ed25519.PrivateKey, value KeySet) (SignedKeySet, error) {
	if len(rootPrivateKey) != ed25519.PrivateKeySize || value.Version == 0 || value.Purpose == "" || value.SigningKeyID == "" {
		return SignedKeySet{}, ErrKeySetSignature
	}
	for _, key := range value.Keys {
		if key.KeyID == "" || key.Algorithm != AlgorithmEdDSA || len(key.PublicKey) != ed25519.PublicKeySize || !key.NotAfter.After(key.NotBefore) {
			return SignedKeySet{}, ErrKeySetSignature
		}
	}
	value.PayloadHash = ""
	core, err := json.Marshal(value)
	if err != nil {
		return SignedKeySet{}, err
	}
	hash := sha256.Sum256(core)
	value.PayloadHash = base64.RawURLEncoding.EncodeToString(hash[:])
	payload, err := json.Marshal(value)
	if err != nil {
		return SignedKeySet{}, err
	}
	signature := ed25519.Sign(rootPrivateKey, payload)
	return SignedKeySet{Algorithm: AlgorithmEdDSA, SigningKeyID: value.SigningKeyID, Payload: payload, Signature: base64.RawURLEncoding.EncodeToString(signature)}, nil
}

func VerifyKeySet(rootPublicKey ed25519.PublicKey, signed SignedKeySet, previous *KeySet, now time.Time) (KeySet, error) {
	if signed.Algorithm != AlgorithmEdDSA || len(rootPublicKey) != ed25519.PublicKeySize {
		return KeySet{}, ErrKeySetSignature
	}
	signature, err := base64.RawURLEncoding.DecodeString(signed.Signature)
	if err != nil || !ed25519.Verify(rootPublicKey, signed.Payload, signature) {
		return KeySet{}, ErrKeySetSignature
	}
	var value KeySet
	if err := json.Unmarshal(signed.Payload, &value); err != nil {
		return KeySet{}, ErrKeySetSignature
	}
	if value.SigningKeyID != signed.SigningKeyID || value.Version == 0 || value.Purpose == "" {
		return KeySet{}, ErrKeySetSignature
	}
	wantHash := value.PayloadHash
	value.PayloadHash = ""
	core, err := json.Marshal(value)
	if err != nil {
		return KeySet{}, err
	}
	coreHash := sha256.Sum256(core)
	if wantHash != base64.RawURLEncoding.EncodeToString(coreHash[:]) {
		return KeySet{}, ErrKeySetSignature
	}
	value.PayloadHash = wantHash
	fingerprint := sha256.Sum256(signed.Payload)
	value.Fingerprint = base64.RawURLEncoding.EncodeToString(fingerprint[:])
	if previous != nil {
		if value.Version <= previous.Version {
			return KeySet{}, ErrKeySetRollback
		}
		if value.PreviousVersion != previous.Version || value.PreviousFingerprint != previous.Fingerprint {
			return KeySet{}, ErrKeySetChain
		}
	} else if value.Version != 1 || value.PreviousVersion != 0 || value.PreviousFingerprint != "" {
		return KeySet{}, ErrKeySetChain
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	for _, key := range value.Keys {
		if key.Algorithm != AlgorithmEdDSA || len(key.PublicKey) != ed25519.PublicKeySize || !key.NotAfter.After(key.NotBefore) {
			return KeySet{}, ErrKeySetSignature
		}
	}
	return value, nil
}

func FingerprintKey(publicKey ed25519.PublicKey) string {
	sum := sha256.Sum256(publicKey)
	return base64.RawURLEncoding.EncodeToString(sum[:])
}
