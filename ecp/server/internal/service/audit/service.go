package audit

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	"gorm.io/gorm"
)

type AppendWriter interface {
	Append(context.Context, domain.AuditEvent) error
}
type IdempotentAppendWriter interface {
	AppendOnce(context.Context, domain.AuditEvent) error
}
type TransactionalWriter interface {
	Commit(context.Context, domain.AuditEvent, func(*gorm.DB) error) error
}
type Reader interface {
	Query(context.Context, Query) ([]domain.AuditEvent, error)
}
type Clock interface{ Now() time.Time }
type Service struct {
	tx     TransactionalWriter
	ingest AppendWriter
	reader Reader
	clock  Clock
}

func New(tx TransactionalWriter, ingest AppendWriter, reader Reader, clock Clock) *Service {
	if clock == nil {
		clock = realClock{}
	}
	return &Service{tx: tx, ingest: ingest, reader: reader, clock: clock}
}

type realClock struct{}

func (realClock) Now() time.Time { return time.Now().UTC() }

type Operation struct {
	ID, EnterpriseID, ApplicationInstanceID, ActorID, ActorKind, Action, ResourceType, ResourceID string
	SafeDiff                                                                                      map[string]any
}
type ProductEvent struct {
	OperationID, ActorID, ActorKind, Action, ResourceType, ResourceID, Outcome, Reason string
	SafeDiff                                                                           map[string]any
	OccurredAt                                                                         time.Time
}
type IngestRequest struct {
	EnterpriseID, ApplicationInstanceID, AuthenticatedInstanceID string
	Events                                                       []ProductEvent
}
type Query struct {
	EnterpriseID, ApplicationInstanceID, OperationID string
	SequenceAfter                                    uint64
	Limit                                            int
}
type ExportManifest struct {
	Version       uint64    `json:"version"`
	SequenceStart uint64    `json:"sequence_start"`
	SequenceEnd   uint64    `json:"sequence_end"`
	EventCount    uint64    `json:"event_count"`
	CanonicalHash string    `json:"canonical_hash"`
	GeneratedAt   time.Time `json:"generated_at"`
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
func (e *DecisionError) Unwrap() error        { return e.Err }
func decision(reason string, err error) error { return &DecisionError{Reason: reason, Err: err} }

func (s *Service) Intent(ctx context.Context, operation Operation) error {
	if s == nil || s.ingest == nil {
		return decision("audit_ingest_unavailable", nil)
	}
	return s.ingest.Append(ctx, s.event(operation, domain.AuditStageIntent, "pending", ""))
}
func (s *Service) Outcome(ctx context.Context, operation Operation, outcome, reason string) error {
	if s == nil || s.ingest == nil {
		return decision("audit_ingest_unavailable", nil)
	}
	return s.ingest.Append(ctx, s.event(operation, domain.AuditStageOutcome, outcome, reason))
}
func (s *Service) CommitWithMutation(ctx context.Context, operation Operation, mutation func(*gorm.DB) error) error {
	if s == nil || s.tx == nil || mutation == nil {
		return decision("audit_transaction_unavailable", nil)
	}
	return s.tx.Commit(ctx, s.event(operation, domain.AuditStageCommitted, "committed", ""), mutation)
}
func (s *Service) Query(ctx context.Context, query Query) ([]domain.AuditEvent, error) {
	if s == nil || s.reader == nil {
		return nil, decision("audit_reader_unavailable", nil)
	}
	if query.Limit <= 0 || query.Limit > 500 {
		query.Limit = 100
	}
	return s.reader.Query(ctx, query)
}
func (s *Service) ExportManifest(ctx context.Context, query Query) (ExportManifest, error) {
	if s == nil || s.reader == nil {
		return ExportManifest{}, decision("audit_reader_unavailable", nil)
	}
	query.Limit = 500
	var events []domain.AuditEvent
	for {
		page, err := s.reader.Query(ctx, query)
		if err != nil {
			return ExportManifest{}, err
		}
		events = append(events, page...)
		if len(page) < query.Limit {
			break
		}
		next := page[len(page)-1].Sequence
		if next <= query.SequenceAfter {
			return ExportManifest{}, decision("audit_export_sequence_invalid", nil)
		}
		query.SequenceAfter = next
	}
	if len(events) == 0 {
		return ExportManifest{Version: 1, GeneratedAt: s.clock.Now().UTC()}, nil
	}
	encoded, err := json.Marshal(events)
	if err != nil {
		return ExportManifest{}, err
	}
	hash := sha256.Sum256(encoded)
	return ExportManifest{Version: 1, SequenceStart: events[0].Sequence, SequenceEnd: events[len(events)-1].Sequence, EventCount: uint64(len(events)), CanonicalHash: hex.EncodeToString(hash[:]), GeneratedAt: s.clock.Now().UTC()}, nil
}
func (s *Service) Ingest(ctx context.Context, request IngestRequest) error {
	if s == nil || s.ingest == nil {
		return decision("audit_ingest_unavailable", nil)
	}
	if request.ApplicationInstanceID == "" || request.ApplicationInstanceID != request.AuthenticatedInstanceID {
		return decision("audit_instance_mismatch", nil)
	}
	for _, input := range request.Events {
		if input.OperationID == "" || input.Action == "" || input.ResourceType == "" || input.ResourceID == "" {
			return decision("audit_event_invalid", nil)
		}
		occurred := input.OccurredAt
		if occurred.IsZero() {
			occurred = s.clock.Now().UTC()
		}
		value := domain.AuditEvent{ID: productEventID(request.EnterpriseID, request.ApplicationInstanceID, input.OperationID), EnterpriseID: request.EnterpriseID, ApplicationInstanceID: request.ApplicationInstanceID, OperationID: input.OperationID, Stage: domain.AuditStageProduct, ActorID: input.ActorID, ActorKind: input.ActorKind, Action: input.Action, ResourceType: input.ResourceType, ResourceID: input.ResourceID, Outcome: input.Outcome, Reason: input.Reason, SafeDiff: CanonicalJSON(SanitizeDiff(input.SafeDiff)), OccurredAt: occurred, CreatedAt: s.clock.Now().UTC()}
		var err error
		if writer, ok := s.ingest.(IdempotentAppendWriter); ok {
			err = writer.AppendOnce(ctx, value)
		} else {
			err = s.ingest.Append(ctx, value)
		}
		if err != nil {
			return decision("audit_store_error", err)
		}
	}
	return nil
}

func productEventID(enterpriseID, instanceID, operationID string) string {
	hash := sha256.Sum256([]byte(enterpriseID + "\x00" + instanceID + "\x00" + operationID))
	return "aud_" + hex.EncodeToString(hash[:16])
}
func (s *Service) event(operation Operation, stage, outcome, reason string) domain.AuditEvent {
	now := s.clock.Now().UTC()
	return domain.AuditEvent{ID: randomID(), EnterpriseID: operation.EnterpriseID, ApplicationInstanceID: operation.ApplicationInstanceID, OperationID: operation.ID, Stage: stage, ActorID: operation.ActorID, ActorKind: operation.ActorKind, Action: operation.Action, ResourceType: operation.ResourceType, ResourceID: operation.ResourceID, Outcome: outcome, Reason: reason, SafeDiff: CanonicalJSON(SanitizeDiff(operation.SafeDiff)), OccurredAt: now, CreatedAt: now}
}

var allowedDiffFields = map[string]struct{}{"status": {}, "state": {}, "name": {}, "display_name": {}, "version": {}, "policy_version": {}, "lifecycle_version": {}, "identity_sync_version": {}, "resource_version": {}, "previous_status": {}, "new_status": {}, "target_status": {}, "scope_count": {}, "expires_at": {}, "reason": {}, "format_version": {}, "retention": {}}

func SanitizeDiff(input map[string]any) map[string]any {
	result := make(map[string]any)
	for key, value := range input {
		normalized := strings.ToLower(strings.TrimSpace(key))
		if _, allowed := allowedDiffFields[normalized]; allowed {
			switch typed := value.(type) {
			case string:
				if len(typed) > 512 {
					typed = typed[:512]
				}
				result[normalized] = typed
			case bool, float64, int, int64, uint64, nil:
				result[normalized] = typed
			}
		}
	}
	return result
}
func CanonicalJSON(input map[string]any) []byte {
	keys := make([]string, 0, len(input))
	for key := range input {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	ordered := make([]struct {
		Key   string `json:"key"`
		Value any    `json:"value"`
	}, 0, len(keys))
	for _, key := range keys {
		ordered = append(ordered, struct {
			Key   string `json:"key"`
			Value any    `json:"value"`
		}{key, input[key]})
	}
	encoded, _ := json.Marshal(ordered)
	return encoded
}
func randomID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return "aud_" + hex.EncodeToString(value)
}
func reason(err error) string {
	var value *DecisionError
	if errors.As(err, &value) {
		return value.Reason
	}
	return ""
}
