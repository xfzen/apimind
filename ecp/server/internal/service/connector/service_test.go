package connector

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type memoryStore struct {
	channels map[string]domain.ConnectorChannel
	nonces   map[string]struct{}
	keysets  map[uint64]domain.DelegationKeySet
	acks     []domain.DelegationKeySetAck
}

func (s *memoryStore) GetChannel(_ context.Context, id string) (domain.ConnectorChannel, bool, error) {
	value, ok := s.channels[id]
	return value, ok, nil
}
func (s *memoryStore) PutChannel(_ context.Context, value domain.ConnectorChannel) error {
	s.channels[value.ID] = value
	return nil
}
func (s *memoryStore) ConsumeNonce(_ context.Context, value domain.DelegationNonce) (bool, error) {
	key := strings.Join([]string{value.Issuer, value.Audience, value.Purpose, value.Nonce}, "|")
	if _, found := s.nonces[key]; found {
		return false, nil
	}
	s.nonces[key] = struct{}{}
	return true, nil
}
func (s *memoryStore) PutKeySet(_ context.Context, value domain.DelegationKeySet) error {
	s.keysets[value.Version] = value
	return nil
}
func (s *memoryStore) LatestKeySet(_ context.Context, purpose string) (domain.DelegationKeySet, bool, error) {
	var latest domain.DelegationKeySet
	for _, value := range s.keysets {
		if value.Purpose == purpose && value.Version > latest.Version {
			latest = value
		}
	}
	return latest, latest.Version != 0, nil
}
func (s *memoryStore) PutKeySetAck(_ context.Context, value domain.DelegationKeySetAck) error {
	s.acks = append(s.acks, value)
	return nil
}

type secretProvider map[string][]byte

func (p secretProvider) Get(_ context.Context, ref string) ([]byte, error) {
	value, ok := p[ref]
	if !ok {
		return nil, &DecisionError{Reason: "secret_unavailable"}
	}
	return value, nil
}

func fixture(t *testing.T) (*Service, *memoryStore, time.Time) {
	t.Helper()
	now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
	rootPublic, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	store := &memoryStore{channels: map[string]domain.ConnectorChannel{}, nonces: map[string]struct{}{}, keysets: map[uint64]domain.DelegationKeySet{}}
	store.channels["inbound-1"] = domain.NewConnectorChannel("inbound-1", "enterprise-1", "apimind", "instance-a", domain.TrustChannelInbound, []string{"delegate.verify", "keyset.read", "keyset.ack"}, "secret-inbound", now.Add(time.Hour))
	store.channels["outbound-1"] = domain.NewConnectorChannel("outbound-1", "enterprise-1", "apimind", "instance-a", domain.TrustChannelOutbound, []string{"resource.search"}, "secret-outbound", now.Add(time.Hour))
	svc := New(store, secretProvider{"env://root-public": []byte(base64.RawURLEncoding.EncodeToString(rootPublic))}, Config{Issuer: "ecp", RootPublicKeyReference: "env://root-public", RootFingerprint: Fingerprint(rootPublic), Clock: func() time.Time { return now }})
	return svc, store, now
}

func TestInboundConnectorCredentialCannotAuthenticateOutboundCall(t *testing.T) {
	svc, _, _ := fixture(t)
	if _, err := svc.AuthenticateOutbound(context.Background(), "inbound-1", "secret-inbound", "instance-a", "resource.search"); reason(err) != "connector_trust_channel_mismatch" {
		t.Fatalf("reason = %q, err=%v", reason(err), err)
	}
	if _, err := svc.AuthenticateInbound(context.Background(), "outbound-1", "secret-outbound", "instance-a", "delegate.verify"); reason(err) != "connector_trust_channel_mismatch" {
		t.Fatalf("reason = %q, err=%v", reason(err), err)
	}
}

func TestProvisionChannelIsIdempotentAndDoesNotReviveDisabledCredential(t *testing.T) {
	svc, store, now := fixture(t)
	input := ProvisionChannelInput{ID: "bootstrap-1", EnterpriseID: "enterprise-1", ApplicationID: "apimind", InstanceID: "instance-a", Channel: domain.TrustChannelInbound, Scopes: []string{"session.resolve"}, RawSecret: "secret", ExpiresAt: now.Add(time.Hour)}
	first, err := svc.ProvisionChannel(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.ProvisionChannel(context.Background(), input)
	if err != nil || first.SecretDigest != second.SecretDigest {
		t.Fatalf("first=%+v second=%+v err=%v", first, second, err)
	}
	disabled := second
	disabled.Status = "disabled"
	store.channels[disabled.ID] = disabled
	third, err := svc.ProvisionChannel(context.Background(), input)
	if err != nil || third.Status != "disabled" {
		t.Fatalf("disabled credential was revived: %+v err=%v", third, err)
	}
}

func TestConnectorCredentialIsInstanceAndScopeBound(t *testing.T) {
	svc, _, _ := fixture(t)
	if _, err := svc.AuthenticateInbound(context.Background(), "inbound-1", "secret-inbound", "instance-b", "delegate.verify"); reason(err) != "connector_instance_mismatch" {
		t.Fatalf("reason = %q", reason(err))
	}
	if _, err := svc.AuthenticateInbound(context.Background(), "inbound-1", "secret-inbound", "instance-a", "keyset.publish"); reason(err) != "connector_scope_denied" {
		t.Fatalf("reason = %q", reason(err))
	}
	if _, err := svc.AuthenticateInbound(context.Background(), "inbound-1", "wrong", "instance-a", "delegate.verify"); reason(err) != "connector_credential_invalid" {
		t.Fatalf("reason = %q", reason(err))
	}
}

func TestDelegationCannotCrossInstanceOrReplay(t *testing.T) {
	svc, _, now := fixture(t)
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	set := domain.DelegationKeySet{Version: 1, Purpose: domain.KeySetPurposeDelegation, Keys: []domain.DelegationVerificationKey{{KeyID: "key-1", Algorithm: domain.AlgorithmEdDSA, PublicKey: base64.RawURLEncoding.EncodeToString(publicKey), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), Status: domain.KeyStatusActive}}}
	svc.keyCache = set
	token, err := SignDelegation(privateKey, domain.Delegation{Issuer: "ecp", Audience: "instance-a", EnterpriseID: "enterprise-1", ApplicationID: "apimind", InstanceID: "instance-a", ActorPrincipalID: "principal-1", RequestedAction: "project.read", Purpose: domain.DelegationPurposeProduct, OperationID: "op-1", Nonce: "nonce-1", IssuedAt: now.Add(-time.Second), ExpiresAt: now.Add(30 * time.Second), KeyID: "key-1", Algorithm: domain.AlgorithmEdDSA})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.VerifyDelegation(context.Background(), token, "instance-b", domain.DelegationPurposeProduct); reason(err) != "delegation_audience_mismatch" {
		t.Fatalf("reason = %q", reason(err))
	}
	if _, err := svc.VerifyDelegation(context.Background(), token, "instance-a", domain.DelegationPurposeProduct); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.VerifyDelegation(context.Background(), token, "instance-a", domain.DelegationPurposeProduct); reason(err) != "delegation_replay" {
		t.Fatalf("reason = %q", reason(err))
	}
}

func reason(err error) string {
	var value *DecisionError
	if err != nil && AsDecision(err, &value) {
		return value.Reason
	}
	return ""
}
