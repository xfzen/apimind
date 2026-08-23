package svc

import (
	"github.com/xfzen/ecp/server/config"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"

	"gorm.io/gorm"
)

type ServiceContext struct {
	Config config.Config
	DB     *gorm.DB
}

func NewServiceContext(cfg config.Config) *ServiceContext {
	ctx := &ServiceContext{Config: cfg}
	if cfg.Database.Enabled {
		db, err := persistence.Open(cfg.Database)
		if err != nil {
			panic(err)
		}
		ctx.DB = db
	}
	return ctx
}
