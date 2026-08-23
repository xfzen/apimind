package audit

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

const AuditArchivePurpose = "audit.archive/v1"

type ArchiveManifest struct {
	Version       uint64    `json:"version"`
	Purpose       string    `json:"purpose"`
	SequenceStart uint64    `json:"sequence_start"`
	SequenceEnd   uint64    `json:"sequence_end"`
	EventCount    uint64    `json:"event_count"`
	CanonicalHash string    `json:"canonical_hash"`
	CreatedAt     time.Time `json:"created_at"`
	SigningKeyID  string    `json:"signing_kid"`
}
type SignedArchiveManifest struct {
	Algorithm string          `json:"alg"`
	Manifest  ArchiveManifest `json:"manifest"`
	Signature string          `json:"signature"`
}

func SignArchiveManifest(privateKey ed25519.PrivateKey, manifest ArchiveManifest) (SignedArchiveManifest, error) {
	if len(privateKey) != ed25519.PrivateKeySize || manifest.Version == 0 || manifest.Purpose != AuditArchivePurpose || manifest.SigningKeyID == "" {
		return SignedArchiveManifest{}, errors.New("audit_archive_manifest_invalid")
	}
	payload, err := json.Marshal(manifest)
	if err != nil {
		return SignedArchiveManifest{}, err
	}
	return SignedArchiveManifest{Algorithm: "EdDSA", Manifest: manifest, Signature: base64.RawURLEncoding.EncodeToString(ed25519.Sign(privateKey, payload))}, nil
}
func VerifyArchiveManifest(publicKey ed25519.PublicKey, signed SignedArchiveManifest) error {
	if signed.Algorithm != "EdDSA" || len(publicKey) != ed25519.PublicKeySize {
		return errors.New("audit_archive_signature_invalid")
	}
	signature, err := base64.RawURLEncoding.DecodeString(signed.Signature)
	if err != nil {
		return errors.New("audit_archive_signature_invalid")
	}
	payload, err := json.Marshal(signed.Manifest)
	if err != nil || !ed25519.Verify(publicKey, payload, signature) {
		return errors.New("audit_archive_signature_invalid")
	}
	return nil
}

type ArchiveStore interface {
	ReadRange(context.Context, uint64, int) ([]domain.AuditEvent, error)
	PersistVerifiedAndDelete(context.Context, domain.AuditArchive) error
}
type SecretProvider interface {
	Get(context.Context, string) ([]byte, error)
}
type ArchiveConfig struct {
	PrivateKeyReference, PublicKeyReference, SigningKeyID string
	Clock                                                 Clock
}
type ArchiveService struct {
	store   ArchiveStore
	secrets SecretProvider
	config  ArchiveConfig
}

func NewArchiveService(store ArchiveStore, secrets SecretProvider, config ArchiveConfig) *ArchiveService {
	if config.Clock == nil {
		config.Clock = realClock{}
	}
	return &ArchiveService{store: store, secrets: secrets, config: config}
}

func (s *ArchiveService) ArchiveExpired(ctx context.Context, sequenceEnd uint64, limit int) (SignedArchiveManifest, error) {
	if s == nil || s.store == nil || s.secrets == nil || limit <= 0 {
		return SignedArchiveManifest{}, errors.New("audit_archive_unavailable")
	}
	events, err := s.store.ReadRange(ctx, sequenceEnd, limit)
	if err != nil {
		return SignedArchiveManifest{}, err
	}
	if len(events) == 0 {
		return SignedArchiveManifest{}, errors.New("audit_archive_empty")
	}
	canonical, err := json.Marshal(events)
	if err != nil {
		return SignedArchiveManifest{}, err
	}
	hash := sha256.Sum256(canonical)
	privateRaw, err := s.secrets.Get(ctx, s.config.PrivateKeyReference)
	if err != nil {
		return SignedArchiveManifest{}, err
	}
	privateDecoded, err := base64.RawURLEncoding.DecodeString(string(privateRaw))
	if err != nil || len(privateDecoded) != ed25519.PrivateKeySize {
		return SignedArchiveManifest{}, errors.New("audit_archive_private_key_invalid")
	}
	publicRaw, err := s.secrets.Get(ctx, s.config.PublicKeyReference)
	if err != nil {
		return SignedArchiveManifest{}, err
	}
	publicDecoded, err := base64.RawURLEncoding.DecodeString(string(publicRaw))
	if err != nil || len(publicDecoded) != ed25519.PublicKeySize {
		return SignedArchiveManifest{}, errors.New("audit_archive_public_key_invalid")
	}
	manifest := ArchiveManifest{Version: 1, Purpose: AuditArchivePurpose, SequenceStart: events[0].Sequence, SequenceEnd: events[len(events)-1].Sequence, EventCount: uint64(len(events)), CanonicalHash: hex.EncodeToString(hash[:]), CreatedAt: s.config.Clock.Now().UTC(), SigningKeyID: s.config.SigningKeyID}
	signed, err := SignArchiveManifest(ed25519.PrivateKey(privateDecoded), manifest)
	if err != nil {
		return SignedArchiveManifest{}, err
	}
	if err := VerifyArchiveManifest(ed25519.PublicKey(publicDecoded), signed); err != nil {
		return SignedArchiveManifest{}, err
	}
	encoded, _ := json.Marshal(signed)
	verified := s.config.Clock.Now().UTC()
	archive := domain.AuditArchive{ID: fmt.Sprintf("archive-%d-%d", manifest.SequenceStart, manifest.SequenceEnd), SequenceStart: manifest.SequenceStart, SequenceEnd: manifest.SequenceEnd, EventCount: manifest.EventCount, CanonicalHash: manifest.CanonicalHash, Manifest: encoded, VerifiedAt: &verified, CreatedAt: verified}
	if err := s.store.PersistVerifiedAndDelete(ctx, archive); err != nil {
		return SignedArchiveManifest{}, err
	}
	return signed, nil
}

type VerifierKey struct {
	KeyID, Algorithm, PublicKey string
	NotBefore, NotAfter         time.Time
}
type VerifierBundle struct {
	Version uint64
	Purpose string
	Keys    []VerifierKey
}

func ExportVerifierBundle(keys []VerifierKey) ([]byte, error) {
	if len(keys) == 0 {
		return nil, errors.New("audit_verifier_keys_required")
	}
	return json.Marshal(VerifierBundle{Version: 1, Purpose: AuditArchivePurpose, Keys: keys})
}
