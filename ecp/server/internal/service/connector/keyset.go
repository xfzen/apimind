package connector

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type SignedKeySetEnvelope struct {
	Algorithm    string `json:"alg"`
	SigningKeyID string `json:"signing_kid"`
	Payload      []byte `json:"payload"`
	Signature    string `json:"signature"`
}

func (s *Service) PublishDelegationKeySet(ctx context.Context, claims Claims, envelope SignedKeySetEnvelope) (domain.DelegationKeySet, error) {
	if claims.Channel != domain.TrustChannelKeySetOperator || !contains(claims.Scopes, "keyset.publish") {
		return domain.DelegationKeySet{}, decision("keyset_publish_credential_rejected", nil)
	}
	root, err := s.rootPublicKey(ctx)
	if err != nil {
		return domain.DelegationKeySet{}, err
	}
	value, err := verifyKeySetEnvelope(root, envelope)
	if err != nil {
		return domain.DelegationKeySet{}, err
	}
	previous, found, err := s.store.LatestKeySet(ctx, value.Purpose)
	if err != nil {
		return domain.DelegationKeySet{}, decision("keyset_store_error", err)
	}
	if !found {
		if value.Version != 1 || value.PreviousVersion != 0 || value.PreviousFingerprint != "" {
			return domain.DelegationKeySet{}, decision("keyset_initial_chain_invalid", nil)
		}
	} else {
		if value.Version <= previous.Version {
			return domain.DelegationKeySet{}, decision("keyset_version_rollback", nil)
		}
		if value.PreviousVersion != previous.Version || value.PreviousFingerprint != previous.Fingerprint {
			return domain.DelegationKeySet{}, decision("keyset_previous_fingerprint_mismatch", nil)
		}
	}
	value.ID = "keyset-" + value.Purpose + "-" + fmtUint(value.Version)
	value.CreatedAt = s.config.Clock().UTC()
	value.KeysJSON, _ = json.Marshal(value.Keys)
	if err := s.store.PutKeySet(ctx, value); err != nil {
		return domain.DelegationKeySet{}, decision("keyset_store_error", err)
	}
	s.keyCache = value
	return value, nil
}

func (s *Service) GetDelegationKeySet(ctx context.Context, claims Claims) (domain.DelegationKeySet, string, error) {
	if claims.Channel != domain.TrustChannelInbound || !contains(claims.Scopes, "keyset.read") {
		return domain.DelegationKeySet{}, "", decision("keyset_read_denied", nil)
	}
	value, err := s.currentKeySet(ctx)
	if err != nil {
		return domain.DelegationKeySet{}, "", err
	}
	return value, s.config.RootFingerprint, nil
}

func (s *Service) AckDelegationKeySet(ctx context.Context, claims Claims, version uint64, acceptedKeyIDs []string) error {
	if claims.Channel != domain.TrustChannelInbound || !contains(claims.Scopes, "keyset.ack") {
		return decision("keyset_ack_denied", nil)
	}
	value, err := s.currentKeySet(ctx)
	if err != nil {
		return err
	}
	if value.Version != version || len(acceptedKeyIDs) == 0 {
		return decision("keyset_ack_version_mismatch", nil)
	}
	for _, id := range acceptedKeyIDs {
		found := false
		for _, key := range value.Keys {
			if key.KeyID == id && key.Status != domain.KeyStatusRevoked {
				found = true
				break
			}
		}
		if !found {
			return decision("keyset_ack_unknown_kid", nil)
		}
	}
	encoded, _ := json.Marshal(acceptedKeyIDs)
	now := s.config.Clock().UTC()
	idHash := sha256.Sum256([]byte(claims.ConnectorID + "\x00" + fmtUint(version)))
	return s.store.PutKeySetAck(ctx, domain.DelegationKeySetAck{ID: hex.EncodeToString(idHash[:]), ConnectorID: claims.ConnectorID, InstanceID: claims.InstanceID, Version: version, AcceptedKeyIDsJSON: encoded, AcknowledgedAt: now})
}

func (s *Service) rootPublicKey(ctx context.Context) (ed25519.PublicKey, error) {
	if s.secrets == nil {
		return nil, decision("keyset_root_unavailable", nil)
	}
	raw, err := s.secrets.Get(ctx, s.config.RootPublicKeyReference)
	if err != nil {
		return nil, decision("keyset_root_unavailable", err)
	}
	decoded, err := base64.RawURLEncoding.DecodeString(string(raw))
	if err != nil || len(decoded) != ed25519.PublicKeySize {
		return nil, decision("keyset_root_invalid", err)
	}
	publicKey := ed25519.PublicKey(decoded)
	if s.config.RootFingerprint == "" || Fingerprint(publicKey) != s.config.RootFingerprint {
		return nil, decision("keyset_root_fingerprint_mismatch", nil)
	}
	return publicKey, nil
}

func verifyKeySetEnvelope(root ed25519.PublicKey, envelope SignedKeySetEnvelope) (domain.DelegationKeySet, error) {
	if envelope.Algorithm != domain.AlgorithmEdDSA {
		return domain.DelegationKeySet{}, decision("keyset_algorithm_mismatch", nil)
	}
	signature, err := base64.RawURLEncoding.DecodeString(envelope.Signature)
	if err != nil || !ed25519.Verify(root, envelope.Payload, signature) {
		return domain.DelegationKeySet{}, decision("keyset_root_signature_invalid", nil)
	}
	var value domain.DelegationKeySet
	if err := json.Unmarshal(envelope.Payload, &value); err != nil {
		return domain.DelegationKeySet{}, decision("keyset_payload_invalid", err)
	}
	if value.SigningKeyID != envelope.SigningKeyID || value.Version == 0 || value.Purpose != domain.KeySetPurposeDelegation {
		return domain.DelegationKeySet{}, decision("keyset_payload_invalid", nil)
	}
	want := value.PayloadHash
	value.PayloadHash = ""
	value.RootSignature = ""
	value.Fingerprint = ""
	core, _ := json.Marshal(value)
	hash := sha256.Sum256(core)
	if want != base64.RawURLEncoding.EncodeToString(hash[:]) {
		return domain.DelegationKeySet{}, decision("keyset_payload_hash_mismatch", nil)
	}
	value.PayloadHash = want
	fingerprint := sha256.Sum256(envelope.Payload)
	value.Fingerprint = base64.RawURLEncoding.EncodeToString(fingerprint[:])
	value.RootSignature = envelope.Signature
	for _, key := range value.Keys {
		decoded, err := base64.RawURLEncoding.DecodeString(key.PublicKey)
		if err != nil || len(decoded) != ed25519.PublicKeySize || key.Algorithm != domain.AlgorithmEdDSA || !key.NotAfter.After(key.NotBefore) {
			return domain.DelegationKeySet{}, decision("keyset_key_invalid", nil)
		}
	}
	return value, nil
}

func SignKeySetEnvelope(rootPrivate ed25519.PrivateKey, value domain.DelegationKeySet) (SignedKeySetEnvelope, error) {
	if len(rootPrivate) != ed25519.PrivateKeySize || value.Version == 0 || value.Purpose != domain.KeySetPurposeDelegation || value.SigningKeyID == "" {
		return SignedKeySetEnvelope{}, decision("keyset_signing_key_invalid", nil)
	}
	value.PayloadHash = ""
	value.RootSignature = ""
	value.Fingerprint = ""
	core, err := json.Marshal(value)
	if err != nil {
		return SignedKeySetEnvelope{}, err
	}
	hash := sha256.Sum256(core)
	value.PayloadHash = base64.RawURLEncoding.EncodeToString(hash[:])
	payload, err := json.Marshal(value)
	if err != nil {
		return SignedKeySetEnvelope{}, err
	}
	return SignedKeySetEnvelope{Algorithm: domain.AlgorithmEdDSA, SigningKeyID: value.SigningKeyID, Payload: payload, Signature: base64.RawURLEncoding.EncodeToString(ed25519.Sign(rootPrivate, payload))}, nil
}

func fmtUint(value uint64) string {
	if value == 0 {
		return "0"
	}
	var data [20]byte
	position := len(data)
	for value > 0 {
		position--
		data[position] = byte('0' + value%10)
		value /= 10
	}
	return string(data[position:])
}

var _ = time.Time{}
