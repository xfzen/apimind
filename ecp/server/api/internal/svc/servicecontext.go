package svc

import "github.com/xfzen/ecp/server/config"

type ServiceContext struct {
	Config config.Config
}

func NewServiceContext(cfg config.Config) *ServiceContext {
	return &ServiceContext{Config: cfg}
}
