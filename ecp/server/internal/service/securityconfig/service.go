package securityconfig

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"github.com/xfzen/ecp/server/internal/domain"
	"time"
)

type Store interface {
	Get(context.Context, string, string) (domain.SecurityConfig, bool, error)
	Put(context.Context, domain.SecurityConfig) (domain.SecurityConfig, error)
}
type Service struct{ store Store }

func New(store Store) *Service { return &Service{store: store} }

type PutInput struct {
	EnterpriseID, ApplicationInstanceID        string
	PublicSharing, ExportEnabled, SecretExport bool
}

func (s *Service) Put(ctx context.Context, input PutInput) (domain.SecurityConfig, error) {
	if s == nil || s.store == nil {
		return domain.SecurityConfig{}, fmt.Errorf("security_config_unavailable")
	}
	if input.EnterpriseID == "" || input.ApplicationInstanceID == "" || input.SecretExport && !input.ExportEnabled || input.PublicSharing && input.SecretExport {
		return domain.SecurityConfig{}, fmt.Errorf("security_config_invalid")
	}
	value, found, err := s.store.Get(ctx, input.EnterpriseID, input.ApplicationInstanceID)
	if err != nil {
		return domain.SecurityConfig{}, err
	}
	now := time.Now().UTC()
	if !found {
		value = domain.SecurityConfig{Base: domain.Base{ID: newID(), EnterpriseID: input.EnterpriseID, CreatedAt: now}, ApplicationInstanceID: input.ApplicationInstanceID}
	}
	value.PublicSharing, value.ExportEnabled, value.SecretExport = input.PublicSharing, input.ExportEnabled, input.SecretExport
	value.Version++
	value.UpdatedAt = now
	return s.store.Put(ctx, value)
}
func (s *Service) Get(ctx context.Context, enterpriseID, instanceID string) (domain.SecurityConfig, error) {
	value, found, err := s.store.Get(ctx, enterpriseID, instanceID)
	if err != nil {
		return domain.SecurityConfig{}, err
	}
	if !found {
		return domain.SecurityConfig{}, fmt.Errorf("security_config_not_found")
	}
	return value, nil
}
func newID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		panic(err)
	}
	return "sec_" + hex.EncodeToString(value)
}
