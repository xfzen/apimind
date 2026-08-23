package connectorv1

import (
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"testing"
	"time"
)

func TestSignAndVerifyDelegation(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	want := Delegation{
		Issuer: "ecp", Audience: "apimind-local", Subject: "principal-1",
		EnterpriseID: "enterprise-1", ApplicationID: "apimind", InstanceID: "apimind-local",
		ResourceType: "workspace", ResourceID: "workspace-1", Actions: []string{"read"},
		IssuedAt: time.Unix(1_700_000_000, 0).UTC(), ExpiresAt: time.Unix(1_700_000_060, 0).UTC(),
		Nonce: "nonce-1", KeyID: "key-1",
	}
	signed, err := SignDelegation(privateKey, want)
	if err != nil {
		t.Fatal(err)
	}
	got, err := VerifyDelegation(publicKey, signed)
	if err != nil {
		t.Fatal(err)
	}
	if got.Type != DelegationTypeV1 || got.ResourceID != want.ResourceID || got.Audience != want.Audience {
		t.Fatalf("verified delegation = %#v", got)
	}

	signed.Payload[0] ^= 1
	if _, err := VerifyDelegation(publicKey, signed); !errors.Is(err, ErrInvalidSignature) {
		t.Fatalf("tampered signature error = %v", err)
	}
}

func TestVerifyDelegationRejectsAudienceExpiryAndReplay(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
	signed, err := SignDelegation(privateKey, Delegation{
		Issuer: "ecp", Audience: "instance-a", Subject: "principal-1", Purpose: DelegationPurposeProduct,
		EnterpriseID: "enterprise-1", ApplicationID: "apimind", InstanceID: "instance-a",
		RequestedAction: "project.read", OperationID: "operation-1", Nonce: "nonce-1", KeyID: "key-1",
		IssuedAt: now.Add(-time.Second), ExpiresAt: now.Add(30 * time.Second),
	})
	if err != nil {
		t.Fatal(err)
	}
	replay := NewMemoryReplayStore()
	if _, err := VerifyDelegationFor(publicKey, signed, VerifyOptions{Audience: "instance-b", Purpose: DelegationPurposeProduct, Now: now, Replay: replay}); !errors.Is(err, ErrAudienceMismatch) {
		t.Fatalf("audience error = %v", err)
	}
	if _, err := VerifyDelegationFor(publicKey, signed, VerifyOptions{Audience: "instance-a", Purpose: DelegationPurposeProduct, Now: now, Replay: replay}); err != nil {
		t.Fatal(err)
	}
	if _, err := VerifyDelegationFor(publicKey, signed, VerifyOptions{Audience: "instance-a", Purpose: DelegationPurposeProduct, Now: now, Replay: replay}); !errors.Is(err, ErrDelegationReplay) {
		t.Fatalf("replay error = %v", err)
	}
	if _, err := VerifyDelegationFor(publicKey, signed, VerifyOptions{Audience: "instance-a", Purpose: DelegationPurposeProduct, Now: now.Add(time.Minute), Replay: NewMemoryReplayStore()}); !errors.Is(err, ErrDelegationExpired) {
		t.Fatalf("expiry error = %v", err)
	}
}

func TestDelegationLifetimeAndFreshnessAreBounded(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
	_, err = SignDelegation(privateKey, Delegation{Issuer: "ecp", Audience: "instance-a", Subject: "principal-1", Purpose: DelegationPurposeProduct, Nonce: "n", KeyID: "k", IssuedAt: now, ExpiresAt: now.Add(61 * time.Second)})
	if !errors.Is(err, ErrDelegationLifetime) {
		t.Fatalf("lifetime error = %v", err)
	}
	_, err = SignDelegation(privateKey, Delegation{Issuer: "ecp", Audience: "instance-a", Subject: "principal-1", Purpose: DelegationPurposeProduct, Nonce: "n", KeyID: "k", IssuedAt: now, ExpiresAt: now.Add(30 * time.Second), IdentityFreshnessDeadline: now.Add(20 * time.Second)})
	if !errors.Is(err, ErrDelegationFreshness) {
		t.Fatalf("freshness error = %v", err)
	}
}

func TestSignedKeySetRejectsBrokenChainAndRollback(t *testing.T) {
	rootPublic, rootPrivate, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	keyPublic, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
	first, err := SignKeySet(rootPrivate, KeySet{Version: 1, Purpose: KeySetPurposeDelegation, Keys: []VerificationKey{{KeyID: "online-1", Algorithm: AlgorithmEdDSA, PublicKey: keyPublic, NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), Status: KeyStatusActive}}, SigningKeyID: "root-1"})
	if err != nil {
		t.Fatal(err)
	}
	verified, err := VerifyKeySet(rootPublic, first, nil, now)
	if err != nil {
		t.Fatal(err)
	}
	if verified.Version != 1 || verified.Fingerprint == "" {
		t.Fatalf("unexpected keyset: %+v", verified)
	}
	rollback := first
	if _, err := VerifyKeySet(rootPublic, rollback, &verified, now); !errors.Is(err, ErrKeySetRollback) {
		t.Fatalf("rollback error = %v", err)
	}
	second, err := SignKeySet(rootPrivate, KeySet{Version: 2, Purpose: KeySetPurposeDelegation, PreviousVersion: 1, PreviousFingerprint: "broken", Keys: verified.Keys, SigningKeyID: "root-1"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := VerifyKeySet(rootPublic, second, &verified, now); !errors.Is(err, ErrKeySetChain) {
		t.Fatalf("chain error = %v", err)
	}
}
