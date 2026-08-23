package audit

import (
	"crypto/ed25519"
	"crypto/rand"
	"testing"
	"time"
)

func TestArchiveManifestSignatureCoversSequenceHashAndCount(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	manifest := ArchiveManifest{Version: 1, Purpose: AuditArchivePurpose, SequenceStart: 10, SequenceEnd: 20, EventCount: 11, CanonicalHash: "hash", CreatedAt: time.Date(2026, 8, 24, 2, 0, 0, 0, time.UTC), SigningKeyID: "audit-root-1"}
	signed, err := SignArchiveManifest(privateKey, manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := VerifyArchiveManifest(publicKey, signed); err != nil {
		t.Fatal(err)
	}
	signed.Manifest.EventCount++
	if err := VerifyArchiveManifest(publicKey, signed); err == nil {
		t.Fatal("tampered manifest was accepted")
	}
}
