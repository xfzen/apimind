package connector

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"testing"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

func TestPublishKeySetPinsRootAndEnforcesChain(t *testing.T) {
	now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
	rootPublic, rootPrivate, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	onlinePublic, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	store := &memoryStore{channels: map[string]domain.ConnectorChannel{}, nonces: map[string]struct{}{}, keysets: map[uint64]domain.DelegationKeySet{}}
	svc := New(store, secretProvider{"root": []byte(base64.RawURLEncoding.EncodeToString(rootPublic))}, Config{Issuer: "ecp", RootPublicKeyReference: "root", RootFingerprint: Fingerprint(rootPublic), Clock: func() time.Time { return now }})
	operator := Claims{Channel: domain.TrustChannelKeySetOperator, Scopes: []string{"keyset.publish"}}
	first := domain.DelegationKeySet{Version: 1, Purpose: domain.KeySetPurposeDelegation, SigningKeyID: "root-1", Keys: []domain.DelegationVerificationKey{{KeyID: "online-1", Algorithm: domain.AlgorithmEdDSA, PublicKey: base64.RawURLEncoding.EncodeToString(onlinePublic), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), Status: domain.KeyStatusActive}}}
	envelope, err := SignKeySetEnvelope(rootPrivate, first)
	if err != nil {
		t.Fatal(err)
	}
	published, err := svc.PublishDelegationKeySet(context.Background(), operator, envelope)
	if err != nil {
		t.Fatal(err)
	}
	if published.Version != 1 || published.Fingerprint == "" {
		t.Fatalf("published = %+v", published)
	}
	second := first
	second.Version = 2
	second.PreviousVersion = 1
	second.PreviousFingerprint = "broken"
	envelope, err = SignKeySetEnvelope(rootPrivate, second)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.PublishDelegationKeySet(context.Background(), operator, envelope); reason(err) != "keyset_previous_fingerprint_mismatch" {
		t.Fatalf("reason = %q", reason(err))
	}
}

func TestInvalidRootSignatureAndConnectorPublishAreRejected(t *testing.T) {
	now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
	rootPublic, rootPrivate, _ := ed25519.GenerateKey(rand.Reader)
	otherPublic, _, _ := ed25519.GenerateKey(rand.Reader)
	onlinePublic, _, _ := ed25519.GenerateKey(rand.Reader)
	store := &memoryStore{channels: map[string]domain.ConnectorChannel{}, nonces: map[string]struct{}{}, keysets: map[uint64]domain.DelegationKeySet{}}
	svc := New(store, secretProvider{"root": []byte(base64.RawURLEncoding.EncodeToString(otherPublic))}, Config{RootPublicKeyReference: "root", RootFingerprint: Fingerprint(otherPublic), Clock: func() time.Time { return now }})
	envelope, err := SignKeySetEnvelope(rootPrivate, domain.DelegationKeySet{Version: 1, Purpose: domain.KeySetPurposeDelegation, SigningKeyID: "root", Keys: []domain.DelegationVerificationKey{{KeyID: "online", Algorithm: domain.AlgorithmEdDSA, PublicKey: base64.RawURLEncoding.EncodeToString(onlinePublic), NotBefore: now, NotAfter: now.Add(time.Hour), Status: domain.KeyStatusActive}}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.PublishDelegationKeySet(context.Background(), Claims{Channel: domain.TrustChannelKeySetOperator, Scopes: []string{"keyset.publish"}}, envelope); reason(err) != "keyset_root_signature_invalid" {
		t.Fatalf("reason = %q", reason(err))
	}
	svc.secrets = secretProvider{"root": []byte(base64.RawURLEncoding.EncodeToString(rootPublic))}
	svc.config.RootFingerprint = Fingerprint(rootPublic)
	if _, err := svc.PublishDelegationKeySet(context.Background(), Claims{Channel: domain.TrustChannelInbound, Scopes: []string{"keyset.publish"}}, envelope); reason(err) != "keyset_publish_credential_rejected" {
		t.Fatalf("reason = %q", reason(err))
	}
}

func TestKeySetAckRequiresExactVersionAndKnownKey(t *testing.T) {
	svc, store, now := fixture(t)
	svc.keyCache = domain.DelegationKeySet{Version: 2, Purpose: domain.KeySetPurposeDelegation, Keys: []domain.DelegationVerificationKey{{KeyID: "online-2", Algorithm: domain.AlgorithmEdDSA, NotBefore: now, NotAfter: now.Add(time.Hour), Status: domain.KeyStatusActive}}}
	claims := Claims{ConnectorID: "connector-1", InstanceID: "instance-a", Channel: domain.TrustChannelInbound, Scopes: []string{"keyset.ack"}}
	if err := svc.AckDelegationKeySet(context.Background(), claims, 1, []string{"online-2"}); reason(err) != "keyset_ack_version_mismatch" {
		t.Fatalf("reason = %q", reason(err))
	}
	if err := svc.AckDelegationKeySet(context.Background(), claims, 2, []string{"unknown"}); reason(err) != "keyset_ack_unknown_kid" {
		t.Fatalf("reason = %q", reason(err))
	}
	if err := svc.AckDelegationKeySet(context.Background(), claims, 2, []string{"online-2"}); err != nil {
		t.Fatal(err)
	}
	if len(store.acks) != 1 {
		t.Fatalf("acks = %d", len(store.acks))
	}
}
