package svc

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	oidcclientservice "github.com/xfzen/ecp/server/internal/service/oidcclient"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"

	"gorm.io/gorm"
)

type ServiceContext struct {
	Config      config.Config
	DB          *gorm.DB
	Registry    *registryservice.Service
	Casdoor     *casdoor.Client
	OIDCClients *oidcclientservice.Service
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
		ctx.OIDCClients = oidcclientservice.New(persistence.NewOIDCClientStore(db), cfg.OIDC.LocalMode)
	}
	if cfg.Casdoor.Enabled {
		client, err := casdoor.NewClient(casdoor.Config{
			BaseURL: cfg.Casdoor.BaseURL, EnterpriseID: cfg.Casdoor.EnterpriseID,
			Organization: cfg.Casdoor.Organization, CredentialReference: cfg.Casdoor.CredentialReference,
			LocalMode: cfg.Casdoor.LocalMode,
		}, envSecretProvider{}, http.DefaultClient)
		if err != nil {
			panic(err)
		}
		ctx.Casdoor = client
	}
	return ctx
}

type envSecretProvider struct{}

func (envSecretProvider) Get(_ context.Context, reference string) ([]byte, error) {
	const prefix = "env://"
	if !strings.HasPrefix(reference, prefix) {
		return nil, fmt.Errorf("unsupported secret reference")
	}
	value, found := os.LookupEnv(strings.TrimPrefix(reference, prefix))
	if !found || value == "" {
		return nil, fmt.Errorf("secret reference unavailable")
	}
	return []byte(value), nil
}
