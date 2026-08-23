package idempotency

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
)

type Store interface {
	GetByKey(context.Context, string, string) (domain.IdempotencyRecord, bool, error)
	Create(context.Context, domain.IdempotencyRecord) error
	Complete(context.Context, domain.IdempotencyRecord) error
}
type Service struct {
	store Store
	ttl   time.Duration
}

func New(store Store) *Service { return &Service{store: store, ttl: 24 * time.Hour} }

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

type BeginInput struct {
	EnterpriseID, OperationID, Key, Method, CanonicalPath string
	Payload                                               []byte
}

func (s *Service) Begin(ctx context.Context, input BeginInput) (domain.IdempotencyRecord, error) {
	if s == nil || s.store == nil || input.EnterpriseID == "" || input.OperationID == "" || input.Key == "" || input.Method == "" || input.CanonicalPath == "" {
		return domain.IdempotencyRecord{}, decision("idempotency_invalid", nil)
	}
	requestHash := digest(input.Payload)
	value, found, err := s.store.GetByKey(ctx, input.EnterpriseID, input.Key)
	if err != nil {
		return domain.IdempotencyRecord{}, decision("idempotency_store_error", err)
	}
	if found {
		if value.OperationID != input.OperationID || value.Method != strings.ToUpper(input.Method) || value.CanonicalPath != input.CanonicalPath || value.RequestHash != requestHash {
			return domain.IdempotencyRecord{}, decision("idempotency_payload_mismatch", nil)
		}
		if value.State == "completed" {
			return domain.IdempotencyRecord{}, decision("idempotency_replay", nil)
		}
		return domain.IdempotencyRecord{}, decision("idempotency_in_progress", nil)
	}
	now := time.Now().UTC()
	value = domain.IdempotencyRecord{Base: domain.Base{ID: newID(), EnterpriseID: input.EnterpriseID, CreatedAt: now, UpdatedAt: now}, OperationID: input.OperationID, IdempotencyKey: input.Key, Method: strings.ToUpper(input.Method), CanonicalPath: input.CanonicalPath, RequestHash: requestHash, State: "started", ExpiresAt: now.Add(s.ttl)}
	if err := s.store.Create(ctx, value); err != nil {
		return domain.IdempotencyRecord{}, decision("idempotency_store_error", err)
	}
	return value, nil
}
func (s *Service) Complete(ctx context.Context, value domain.IdempotencyRecord, status int, body []byte) (domain.IdempotencyRecord, error) {
	value.ResponseStatus, value.ResponseBodyHash, value.State, value.UpdatedAt = status, digest(body), "completed", time.Now().UTC()
	if err := s.store.Complete(ctx, value); err != nil {
		return domain.IdempotencyRecord{}, decision("idempotency_store_error", err)
	}
	return value, nil
}
func digest(value []byte) string { hash := sha256.Sum256(value); return hex.EncodeToString(hash[:]) }
func newID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return "ide_" + hex.EncodeToString(value)
}
func decision(reason string, err error) error { return &DecisionError{Reason: reason, Err: err} }
