package connector

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

const maximumDelegationLifetime = 60 * time.Second

type Store interface {
	GetChannel(context.Context, string) (domain.ConnectorChannel, bool, error)
	ConsumeNonce(context.Context, domain.DelegationNonce) (bool, error)
	PutKeySet(context.Context, domain.DelegationKeySet) error
	LatestKeySet(context.Context, string) (domain.DelegationKeySet, bool, error)
	PutKeySetAck(context.Context, domain.DelegationKeySetAck) error
}

type SecretProvider interface {
	Get(context.Context, string) ([]byte, error)
}

type Config struct {
	Issuer                     string
	RootPublicKeyReference     string
	RootFingerprint            string
	SigningPrivateKeyReference string
	ActiveSigningKeyID         string
	Clock                      func() time.Time
	ClockSkew                  time.Duration
}

type Service struct {
	store    Store
	secrets  SecretProvider
	config   Config
	keyCache domain.DelegationKeySet
}

type policyReader interface {
	GetPolicyProjection(context.Context, string, string) (domain.PolicyProjection, bool, error)
}
type lifecycleReader interface {
	PollLifecycle(context.Context, string, string, int) ([]domain.PrincipalLifecycle, string, error)
}

func New(store Store, secrets SecretProvider, config Config) *Service {
	if config.Clock == nil {
		config.Clock = func() time.Time { return time.Now().UTC() }
	}
	if config.ClockSkew == 0 {
		config.ClockSkew = 30 * time.Second
	}
	return &Service{store: store, secrets: secrets, config: config}
}

type DecisionError struct {
	Reason string
	Err    error
}

func (e *DecisionError) Error() string {
	if e.Err == nil {
		return e.Reason
	}
	return fmt.Sprintf("%s: %v", e.Reason, e.Err)
}
func (e *DecisionError) Unwrap() error                  { return e.Err }
func decision(reason string, err error) error           { return &DecisionError{Reason: reason, Err: err} }
func AsDecision(err error, target **DecisionError) bool { return errors.As(err, target) }

type Claims struct {
	ConnectorID, EnterpriseID, ApplicationID, InstanceID, Audience, Channel string
	Scopes                                                                  []string
}

func (s *Service) AuthenticateInbound(ctx context.Context, connectorID, rawSecret, instanceID, requiredScope string) (Claims, error) {
	return s.authenticate(ctx, connectorID, rawSecret, instanceID, requiredScope, domain.TrustChannelInbound)
}
func (s *Service) AuthenticateInboundCredential(ctx context.Context, connectorID, rawSecret string) (Claims, error) {
	return s.authenticate(ctx, connectorID, rawSecret, "", "", domain.TrustChannelInbound)
}
func (s *Service) AuthenticateOutbound(ctx context.Context, connectorID, rawSecret, instanceID, requiredScope string) (Claims, error) {
	return s.authenticate(ctx, connectorID, rawSecret, instanceID, requiredScope, domain.TrustChannelOutbound)
}
func (s *Service) AuthenticateKeySetOperator(ctx context.Context, credentialID, rawSecret string) (Claims, error) {
	return s.authenticate(ctx, credentialID, rawSecret, "keyset-root", "keyset.publish", domain.TrustChannelKeySetOperator)
}

func (s *Service) authenticate(ctx context.Context, id, rawSecret, instanceID, requiredScope, channel string) (Claims, error) {
	if s == nil || s.store == nil {
		return Claims{}, decision("connector_unavailable", nil)
	}
	value, found, err := s.store.GetChannel(ctx, id)
	if err != nil {
		return Claims{}, decision("connector_store_error", err)
	}
	if !found {
		return Claims{}, decision("connector_credential_invalid", nil)
	}
	if value.Channel != channel {
		return Claims{}, decision("connector_trust_channel_mismatch", nil)
	}
	if instanceID != "" && (value.InstanceID != instanceID || value.Audience != instanceID) {
		return Claims{}, decision("connector_instance_mismatch", nil)
	}
	if value.Status != "active" || !s.config.Clock().Before(value.ExpiresAt) {
		return Claims{}, decision("connector_credential_inactive", nil)
	}
	digest := sha256.Sum256([]byte(rawSecret))
	want, err := hex.DecodeString(value.SecretDigest)
	if err != nil || subtle.ConstantTimeCompare(want, digest[:]) != 1 {
		return Claims{}, decision("connector_credential_invalid", nil)
	}
	var scopes []string
	if err := json.Unmarshal(value.ScopesJSON, &scopes); err != nil {
		return Claims{}, decision("connector_scope_invalid", err)
	}
	if requiredScope != "" && !contains(scopes, requiredScope) {
		return Claims{}, decision("connector_scope_denied", nil)
	}
	return Claims{ConnectorID: value.ID, EnterpriseID: value.EnterpriseID, ApplicationID: value.ApplicationID, InstanceID: value.InstanceID, Audience: value.Audience, Channel: value.Channel, Scopes: scopes}, nil
}

func (s *Service) VerifyDelegation(ctx context.Context, signed domain.SignedDelegation, expectedAudience, expectedPurpose string) (domain.Delegation, error) {
	if signed.Algorithm != domain.AlgorithmEdDSA {
		return domain.Delegation{}, decision("delegation_algorithm_mismatch", nil)
	}
	set, err := s.currentKeySet(ctx)
	if err != nil {
		return domain.Delegation{}, err
	}
	var entry *domain.DelegationVerificationKey
	for index := range set.Keys {
		if set.Keys[index].KeyID == signed.KeyID {
			entry = &set.Keys[index]
			break
		}
	}
	if entry == nil || entry.Algorithm != domain.AlgorithmEdDSA || entry.Status == domain.KeyStatusRevoked {
		return domain.Delegation{}, decision("delegation_unknown_kid", nil)
	}
	now := s.config.Clock().UTC()
	if now.Add(s.config.ClockSkew).Before(entry.NotBefore) || !now.Add(-s.config.ClockSkew).Before(entry.NotAfter) {
		return domain.Delegation{}, decision("delegation_key_inactive", nil)
	}
	publicKey, err := base64.RawURLEncoding.DecodeString(entry.PublicKey)
	if err != nil || len(publicKey) != ed25519.PublicKeySize {
		return domain.Delegation{}, decision("delegation_key_invalid", err)
	}
	signature, err := base64.RawURLEncoding.DecodeString(signed.Signature)
	if err != nil || !ed25519.Verify(publicKey, signed.Payload, signature) {
		return domain.Delegation{}, decision("delegation_signature_invalid", nil)
	}
	var value domain.Delegation
	if err := json.Unmarshal(signed.Payload, &value); err != nil {
		return domain.Delegation{}, decision("delegation_invalid", err)
	}
	if value.Type != domain.DelegationTypeV1 || value.Algorithm != domain.AlgorithmEdDSA || value.KeyID != signed.KeyID {
		return domain.Delegation{}, decision("delegation_algorithm_mismatch", nil)
	}
	if value.Issuer != s.config.Issuer {
		return domain.Delegation{}, decision("delegation_issuer_mismatch", nil)
	}
	if value.Audience != expectedAudience || value.InstanceID != expectedAudience {
		return domain.Delegation{}, decision("delegation_audience_mismatch", nil)
	}
	if value.Purpose != expectedPurpose {
		return domain.Delegation{}, decision("delegation_purpose_mismatch", nil)
	}
	if value.ActorPrincipalID == "" || value.OperationID == "" || value.Nonce == "" || value.RequestedAction == "" {
		return domain.Delegation{}, decision("delegation_invalid", nil)
	}
	if !value.ExpiresAt.After(value.IssuedAt) || value.ExpiresAt.Sub(value.IssuedAt) > maximumDelegationLifetime {
		return domain.Delegation{}, decision("delegation_lifetime_exceeded", nil)
	}
	if now.Add(s.config.ClockSkew).Before(value.IssuedAt) {
		return domain.Delegation{}, decision("delegation_not_yet_valid", nil)
	}
	if !now.Add(-s.config.ClockSkew).Before(value.ExpiresAt) {
		return domain.Delegation{}, decision("delegation_expired", nil)
	}
	if !value.IdentityFreshnessDeadline.IsZero() && value.ExpiresAt.After(value.IdentityFreshnessDeadline) {
		return domain.Delegation{}, decision("delegation_freshness_exceeded", nil)
	}
	digest := sha256.Sum256([]byte(value.Issuer + "\x00" + value.Audience + "\x00" + value.Purpose + "\x00" + value.Nonce))
	consumed, err := s.store.ConsumeNonce(ctx, domain.DelegationNonce{ID: hex.EncodeToString(digest[:]), Issuer: value.Issuer, Audience: value.Audience, Purpose: value.Purpose, Nonce: value.Nonce, ExpiresAt: value.ExpiresAt.Add(s.config.ClockSkew), CreatedAt: now})
	if err != nil {
		return domain.Delegation{}, decision("delegation_replay_store_error", err)
	}
	if !consumed {
		return domain.Delegation{}, decision("delegation_replay", nil)
	}
	return value, nil
}

func (s *Service) currentKeySet(ctx context.Context) (domain.DelegationKeySet, error) {
	if s.keyCache.Version != 0 {
		return s.keyCache, nil
	}
	value, found, err := s.store.LatestKeySet(ctx, domain.KeySetPurposeDelegation)
	if err != nil {
		return domain.DelegationKeySet{}, decision("keyset_store_error", err)
	}
	if !found {
		return domain.DelegationKeySet{}, decision("keyset_unavailable", nil)
	}
	if len(value.Keys) == 0 && len(value.KeysJSON) != 0 {
		if err := json.Unmarshal(value.KeysJSON, &value.Keys); err != nil {
			return domain.DelegationKeySet{}, decision("keyset_invalid", err)
		}
	}
	s.keyCache = value
	return value, nil
}

func SignDelegation(privateKey ed25519.PrivateKey, value domain.Delegation) (domain.SignedDelegation, error) {
	if len(privateKey) != ed25519.PrivateKeySize {
		return domain.SignedDelegation{}, decision("delegation_signing_key_invalid", nil)
	}
	if value.Type == "" {
		value.Type = domain.DelegationTypeV1
	}
	if value.Algorithm == "" {
		value.Algorithm = domain.AlgorithmEdDSA
	}
	if value.Type != domain.DelegationTypeV1 || value.Algorithm != domain.AlgorithmEdDSA || value.KeyID == "" || !value.ExpiresAt.After(value.IssuedAt) || value.ExpiresAt.Sub(value.IssuedAt) > maximumDelegationLifetime || (!value.IdentityFreshnessDeadline.IsZero() && value.ExpiresAt.After(value.IdentityFreshnessDeadline)) {
		return domain.SignedDelegation{}, decision("delegation_invalid", nil)
	}
	payload, err := json.Marshal(value)
	if err != nil {
		return domain.SignedDelegation{}, err
	}
	return domain.SignedDelegation{Algorithm: domain.AlgorithmEdDSA, KeyID: value.KeyID, Payload: payload, Signature: base64.RawURLEncoding.EncodeToString(ed25519.Sign(privateKey, payload))}, nil
}

func (s *Service) IssueDelegation(ctx context.Context, value domain.Delegation) (domain.SignedDelegation, error) {
	if s == nil || s.secrets == nil || s.config.SigningPrivateKeyReference == "" || s.config.ActiveSigningKeyID == "" {
		return domain.SignedDelegation{}, decision("delegation_signer_unavailable", nil)
	}
	set, err := s.currentKeySet(ctx)
	if err != nil {
		return domain.SignedDelegation{}, err
	}
	found := false
	for _, key := range set.Keys {
		if key.KeyID == s.config.ActiveSigningKeyID && key.Status == domain.KeyStatusActive && key.Algorithm == domain.AlgorithmEdDSA {
			found = true
			break
		}
	}
	if !found {
		return domain.SignedDelegation{}, decision("delegation_signing_key_inactive", nil)
	}
	raw, err := s.secrets.Get(ctx, s.config.SigningPrivateKeyReference)
	if err != nil {
		return domain.SignedDelegation{}, decision("delegation_signing_key_unavailable", err)
	}
	decoded, err := base64.RawURLEncoding.DecodeString(string(raw))
	if err != nil || len(decoded) != ed25519.PrivateKeySize {
		return domain.SignedDelegation{}, decision("delegation_signing_key_invalid", err)
	}
	now := s.config.Clock().UTC()
	value.Type = domain.DelegationTypeV1
	value.Algorithm = domain.AlgorithmEdDSA
	value.Issuer = s.config.Issuer
	value.KeyID = s.config.ActiveSigningKeyID
	if value.IssuedAt.IsZero() {
		value.IssuedAt = now
	}
	if value.ExpiresAt.IsZero() {
		value.ExpiresAt = now.Add(maximumDelegationLifetime)
	}
	if !value.IdentityFreshnessDeadline.IsZero() && value.ExpiresAt.After(value.IdentityFreshnessDeadline) {
		value.ExpiresAt = value.IdentityFreshnessDeadline
	}
	return SignDelegation(ed25519.PrivateKey(decoded), value)
}

func Fingerprint(publicKey ed25519.PublicKey) string {
	hash := sha256.Sum256(publicKey)
	return base64.RawURLEncoding.EncodeToString(hash[:])
}
func contains(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

func (s *Service) GetPolicyVersion(ctx context.Context, claims Claims) (domain.PolicyProjection, error) {
	if claims.Channel != domain.TrustChannelInbound || !contains(claims.Scopes, "policy.read") {
		return domain.PolicyProjection{}, decision("connector_scope_denied", nil)
	}
	reader, ok := s.store.(policyReader)
	if !ok {
		return domain.PolicyProjection{}, decision("policy_reader_unavailable", nil)
	}
	value, found, err := reader.GetPolicyProjection(ctx, claims.EnterpriseID, claims.InstanceID)
	if err != nil {
		return domain.PolicyProjection{}, decision("connector_store_error", err)
	}
	if !found {
		return domain.PolicyProjection{}, decision("policy_projection_not_found", nil)
	}
	return value, nil
}

func (s *Service) PollLifecycleChanges(ctx context.Context, claims Claims, cursor string, limit int) ([]domain.PrincipalLifecycle, string, error) {
	if claims.Channel != domain.TrustChannelInbound || !contains(claims.Scopes, "lifecycle.read") {
		return nil, "", decision("connector_scope_denied", nil)
	}
	reader, ok := s.store.(lifecycleReader)
	if !ok {
		return nil, "", decision("lifecycle_reader_unavailable", nil)
	}
	values, next, err := reader.PollLifecycle(ctx, claims.EnterpriseID, cursor, limit)
	if err != nil {
		return nil, "", decision("connector_store_error", err)
	}
	return values, next, nil
}
