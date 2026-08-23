package operation

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	auditservice "github.com/xfzen/ecp/server/internal/service/audit"
)

type ManifestMetadata struct {
	APIVersion string `json:"api_version"`
	Hash       string `json:"hash"`
	Version    uint64 `json:"version"`
}

type CredentialMetadata struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Status     string    `json:"status"`
	ScopeCount int       `json:"scope_count"`
	ExpiresAt  time.Time `json:"expires_at"`
	Version    uint64    `json:"version"`
}

type EnterpriseMetadata struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

type ApplicationMetadata struct {
	ID      string `json:"id"`
	Key     string `json:"key"`
	Name    string `json:"name"`
	Status  string `json:"status"`
	Version uint64 `json:"version"`
}

type InstanceMetadata struct {
	ID            string `json:"id"`
	ApplicationID string `json:"application_id"`
	InstanceKey   string `json:"instance_key"`
	Environment   string `json:"environment"`
	CanonicalURL  string `json:"canonical_url"`
	Status        string `json:"status"`
	Version       uint64 `json:"version"`
}

type IdentityMappingMetadata struct {
	ID            string `json:"id"`
	ApplicationID string `json:"application_id"`
	LegacySource  string `json:"legacy_source"`
	LegacySubject string `json:"legacy_subject"`
	PrincipalID   string `json:"principal_id"`
}

type PolicyMetadata struct {
	ApplicationInstanceID string   `json:"application_instance_id"`
	PermissionID          string   `json:"permission_id"`
	PolicyIDs             []string `json:"policy_ids"`
	CanonicalHash         string   `json:"canonical_hash"`
	ManifestVersion       uint64   `json:"manifest_version"`
	PolicyVersion         uint64   `json:"policy_version"`
	State                 string   `json:"state"`
}

type ExportData struct {
	Enterprise       EnterpriseMetadata        `json:"enterprise"`
	Application      ApplicationMetadata       `json:"application"`
	Instance         InstanceMetadata          `json:"instance"`
	IdentityMappings []IdentityMappingMetadata `json:"identity_mappings"`
	Manifests        []ManifestMetadata        `json:"manifests"`
	Policy           *PolicyMetadata           `json:"policy,omitempty"`
	Credentials      []CredentialMetadata      `json:"credentials"`
}

type PortableExport struct {
	Version       uint64                      `json:"version"`
	GeneratedAt   time.Time                   `json:"generated_at"`
	Data          ExportData                  `json:"data"`
	AuditManifest auditservice.ExportManifest `json:"audit_manifest"`
	CanonicalHash string                      `json:"canonical_hash"`
}

type ExportStore interface {
	LoadExportData(context.Context, string, string) (ExportData, error)
	LatestBackup(context.Context, string) (domain.BackupOperation, bool, error)
	RecordBackup(context.Context, domain.BackupOperation) error
}

type RecordBackupInput struct {
	EnterpriseID, BackupID, State, ManifestHash, FailureReason string
	StartedAt, CompletedAt, VerifiedAt                         time.Time
}

func (s *Service) RecordBackup(ctx context.Context, input RecordBackupInput) error {
	if s == nil || s.store == nil || input.EnterpriseID == "" || input.BackupID == "" || input.State == "" || input.StartedAt.IsZero() {
		return fmt.Errorf("backup_status_invalid")
	}
	switch input.State {
	case "in_progress":
		if !input.CompletedAt.IsZero() || !input.VerifiedAt.IsZero() {
			return fmt.Errorf("backup_status_invalid")
		}
	case "failed", "completed":
		if input.CompletedAt.IsZero() || !input.VerifiedAt.IsZero() {
			return fmt.Errorf("backup_status_invalid")
		}
	case "verified":
		if input.CompletedAt.IsZero() || input.VerifiedAt.IsZero() || input.ManifestHash == "" {
			return fmt.Errorf("backup_status_invalid")
		}
	default:
		return fmt.Errorf("backup_status_invalid")
	}
	value := domain.BackupOperation{Base: domain.Base{ID: backupOperationID(input.EnterpriseID, input.BackupID), EnterpriseID: input.EnterpriseID, CreatedAt: s.now().UTC(), UpdatedAt: s.now().UTC()}, BackupID: input.BackupID, State: input.State, ManifestHash: input.ManifestHash, FailureReason: input.FailureReason, StartedAt: input.StartedAt.UTC()}
	if !input.CompletedAt.IsZero() {
		completed := input.CompletedAt.UTC()
		value.CompletedAt = &completed
	}
	if !input.VerifiedAt.IsZero() {
		verified := input.VerifiedAt.UTC()
		value.VerifiedAt = &verified
	}
	return s.store.RecordBackup(ctx, value)
}

func backupOperationID(enterpriseID, backupID string) string {
	digest := sha256.Sum256([]byte(enterpriseID + "\x00" + backupID))
	return "bkp_" + hex.EncodeToString(digest[:16])
}

type AuditExporter interface {
	ExportManifest(context.Context, auditservice.Query) (auditservice.ExportManifest, error)
}

type Service struct {
	store    ExportStore
	audit    AuditExporter
	now      func() time.Time
	flush    AuditFlusher
	offboard OffboardStore
}

func New(store ExportStore, audit AuditExporter, offboard OffboardStore, flush AuditFlusher) *Service {
	return &Service{store: store, audit: audit, offboard: offboard, flush: flush, now: time.Now}
}

func (s *Service) ExportInstance(ctx context.Context, enterpriseID, instanceID string) (PortableExport, error) {
	if s == nil || s.store == nil || s.audit == nil || enterpriseID == "" || instanceID == "" {
		return PortableExport{}, fmt.Errorf("operation_export_unavailable")
	}
	data, err := s.store.LoadExportData(ctx, enterpriseID, instanceID)
	if err != nil {
		return PortableExport{}, err
	}
	manifest, err := s.audit.ExportManifest(ctx, auditservice.Query{EnterpriseID: enterpriseID, ApplicationInstanceID: instanceID, Limit: 500})
	if err != nil {
		return PortableExport{}, err
	}
	value := PortableExport{Version: 1, GeneratedAt: s.now().UTC(), Data: data, AuditManifest: manifest}
	value.CanonicalHash, err = exportHash(value)
	return value, err
}

func VerifyExport(value PortableExport) bool {
	want := value.CanonicalHash
	value.CanonicalHash = ""
	encoded, err := json.Marshal(value)
	if err != nil {
		return false
	}
	digest := sha256.Sum256(encoded)
	return want != "" && want == hex.EncodeToString(digest[:])
}

func exportHash(value PortableExport) (string, error) {
	value.CanonicalHash = ""
	encoded, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}

type BackupStatus struct {
	State, BackupID, ManifestHash, FailureReason string
	StartedAt                                    time.Time
	CompletedAt, VerifiedAt                      *time.Time
}

func (s *Service) BackupStatus(ctx context.Context, enterpriseID string) (BackupStatus, error) {
	if s == nil || s.store == nil || enterpriseID == "" {
		return BackupStatus{}, fmt.Errorf("backup_status_unavailable")
	}
	value, found, err := s.store.LatestBackup(ctx, enterpriseID)
	if err != nil {
		return BackupStatus{}, err
	}
	if !found {
		return BackupStatus{State: "never_run"}, nil
	}
	return BackupStatus{State: value.State, BackupID: value.BackupID, ManifestHash: value.ManifestHash, FailureReason: value.FailureReason, StartedAt: value.StartedAt, CompletedAt: value.CompletedAt, VerifiedAt: value.VerifiedAt}, nil
}
