package securityconfig

import (
	"context"
	"strings"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

type memoryStore struct{ value domain.SecurityConfig }

func (s *memoryStore) Get(_ context.Context, enterpriseID, instanceID string) (domain.SecurityConfig, bool, error) {
	return s.value, s.value.EnterpriseID == enterpriseID && s.value.ApplicationInstanceID == instanceID, nil
}
func (s *memoryStore) Put(_ context.Context, value domain.SecurityConfig) (domain.SecurityConfig, error) {
	s.value = value
	return value, nil
}
func TestPublicSharingCannotBypassSecretPolicy(t *testing.T) {
	service := New(&memoryStore{})
	_, err := service.Put(context.Background(), PutInput{EnterpriseID: "ent-1", ApplicationInstanceID: "ins-1", PublicSharing: true, SecretExport: true})
	if err == nil || !strings.Contains(err.Error(), "security_config_invalid") {
		t.Fatalf("err=%v", err)
	}
}
