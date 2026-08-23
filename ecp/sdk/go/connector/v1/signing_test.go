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
