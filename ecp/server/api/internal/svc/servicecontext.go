package svc

import (
	"github.com/xfzen/ecp/server/config"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"

	"gorm.io/gorm"
)

type ServiceContext struct {
	Config   config.Config
	DB       *gorm.DB
	Registry *registryservice.Service
}

func NewServiceContext(cfg config.Config) *ServiceContext {
	ctx := &ServiceContext{Config: cfg}
	if cfg.Database.Enabled {
		db, err := persistence.Open(cfg.Database)
		if err != nil {
			panic(err)
		}
		ctx.DB = db
		ctx.Registry = registryservice.New(persistence.NewRegistryStore(db))
	}
	return ctx
}
