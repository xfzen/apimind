package svc

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	apiMiddleware "github.com/xfzen/ecp/server/api/internal/middleware"
	"github.com/xfzen/ecp/server/config"
	"github.com/xfzen/ecp/server/internal/infra/casdoor"
	persistence "github.com/xfzen/ecp/server/internal/infra/persistence/gorm"
	idempotencyservice "github.com/xfzen/ecp/server/internal/service/idempotency"
	identityservice "github.com/xfzen/ecp/server/internal/service/identity"
	lifecycleservice "github.com/xfzen/ecp/server/internal/service/lifecycle"
	oidcclientservice "github.com/xfzen/ecp/server/internal/service/oidcclient"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"
	sessionservice "github.com/xfzen/ecp/server/internal/service/session"

	"github.com/zeromicro/go-zero/rest"
	"gorm.io/gorm"
)

type ServiceContext struct {
	Config      config.Config
	DB          *gorm.DB
	Registry    *registryservice.Service
	Casdoor     *casdoor.Client
	OIDCClients *oidcclientservice.Service
	Identity    *identityservice.Service
	Lifecycle   *lifecycleservice.Service
	Sessions    *sessionservice.Service
	Idempotency *idempotencyservice.Service

	AdminSession       rest.Middleware
	CSRF               rest.Middleware
	IdempotencyHeaders rest.Middleware
	RateLimit          rest.Middleware
	ConnectorMachine   rest.Middleware
}

func NewServiceContext(cfg config.Config) *ServiceContext {
	if cfg.OIDC.AdminAudience == "" {
		cfg.OIDC.AdminAudience = cfg.OIDC.ClientID
	}
	ctx := &ServiceContext{Config: cfg}
	if cfg.Database.Enabled {
		db, err := persistence.Open(cfg.Database)
		if err != nil {
			panic(err)
		}
		ctx.DB = db
		ctx.Registry = registryservice.New(persistence.NewRegistryStore(db))
		ctx.OIDCClients = oidcclientservice.New(persistence.NewOIDCClientStore(db), cfg.OIDC.LocalMode)
		ctx.Identity = identityservice.New(persistence.NewIdentityStore(db), cfg.Identity.TrustedIssuers)
		ctx.Lifecycle = lifecycleservice.New(persistence.NewLifecycleStore(db), nil, cfg.Identity.FreshnessTTL)
		var verifier sessionservice.OIDCVerifier
		if cfg.OIDC.Issuer != "" || cfg.OIDC.ClientID != "" || cfg.OIDC.SecretReference != "" {
			value, err := casdoor.NewOIDCVerifier(casdoor.OIDCVerifierConfig{Issuer: cfg.OIDC.Issuer, ClientID: cfg.OIDC.ClientID, SecretReference: cfg.OIDC.SecretReference, LocalMode: cfg.OIDC.LocalMode}, envSecretProvider{})
			if err != nil {
				panic(err)
			}
			verifier = value
		}
		ctx.Sessions = sessionservice.NewWithSecurity(persistence.NewSessionStore(db), nil, cfg.Session.TTL, verifier, identityPrincipalResolver{service: ctx.Identity})
		ctx.Idempotency = idempotencyservice.New(persistence.NewIdempotencyStore(db))
	}
	ctx.AdminSession = asRestMiddleware(apiMiddleware.NewAdminSession(ctx.Sessions).Handle)
	ctx.CSRF = asRestMiddleware(apiMiddleware.NewCSRF().Handle)
	ctx.IdempotencyHeaders = asRestMiddleware(apiMiddleware.NewIdempotency(ctx.Idempotency).Handle)
	ctx.RateLimit = asRestMiddleware(apiMiddleware.NewRateLimit(30, time.Minute).Handle)
	ctx.ConnectorMachine = asRestMiddleware(apiMiddleware.NewConnectorMachine(nil).Handle)
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

func asRestMiddleware(handle func(http.Handler) http.Handler) rest.Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc { return handle(next).ServeHTTP }
}

type envSecretProvider struct{}

type identityPrincipalResolver struct{ service *identityservice.Service }

func (r identityPrincipalResolver) ResolvePrincipal(ctx context.Context, enterpriseID, issuer, subject string) (string, error) {
	if r.service == nil {
		return "", fmt.Errorf("identity service unavailable")
	}
	value, err := r.service.ResolveExternalIdentity(ctx, identityservice.ExternalIdentity{EnterpriseID: enterpriseID, Issuer: issuer, Subject: subject})
	if err != nil {
		return "", err
	}
	return value.ID, nil
}

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
