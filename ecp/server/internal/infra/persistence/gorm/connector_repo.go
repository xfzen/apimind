package persistence

import (
	"context"

	"github.com/xfzen/ecp/server/internal/domain"
)

func (s *RegistryStore) CreateConnector(ctx context.Context, value domain.Connector) error {
	return s.db.WithContext(ctx).Create(&value).Error
}
