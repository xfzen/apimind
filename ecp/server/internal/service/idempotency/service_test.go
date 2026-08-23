package idempotency

import (
	"context"
	"strings"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

type memoryStore struct {
	byKey map[string]domain.IdempotencyRecord
}

func (s *memoryStore) GetByKey(_ context.Context, enterpriseID, key string) (domain.IdempotencyRecord, bool, error) {
	value, ok := s.byKey[enterpriseID+"/"+key]
	return value, ok, nil
}
func (s *memoryStore) Create(_ context.Context, value domain.IdempotencyRecord) error {
	if s.byKey == nil {
		s.byKey = make(map[string]domain.IdempotencyRecord)
	}
	s.byKey[value.EnterpriseID+"/"+value.IdempotencyKey] = value
	return nil
}
func (s *memoryStore) Complete(_ context.Context, value domain.IdempotencyRecord) error {
	s.byKey[value.EnterpriseID+"/"+value.IdempotencyKey] = value
	return nil
}

func TestIdempotencyKeyCannotChangePayload(t *testing.T) {
	service := New(&memoryStore{})
	_, err := service.Begin(context.Background(), BeginInput{EnterpriseID: "ent-1", OperationID: "op-1", Key: "key-1", Method: "POST", CanonicalPath: "/api/v1/identity/block", Payload: []byte(`{"principal_id":"p1"}`)})
	if err != nil {
		t.Fatal(err)
	}
	_, err = service.Begin(context.Background(), BeginInput{EnterpriseID: "ent-1", OperationID: "op-2", Key: "key-1", Method: "POST", CanonicalPath: "/api/v1/identity/block", Payload: []byte(`{"principal_id":"p2"}`)})
	if err == nil || !strings.Contains(err.Error(), "idempotency_payload_mismatch") {
		t.Fatalf("unexpected error: %v", err)
	}
}
