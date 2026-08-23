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
	accessservice "github.com/xfzen/ecp/server/internal/service/access"
	connectorservice "github.com/xfzen/ecp/server/internal/service/connector"
	idempotencyservice "github.com/xfzen/ecp/server/internal/service/idempotency"
	identityservice "github.com/xfzen/ecp/server/internal/service/identity"
	lifecycleservice "github.com/xfzen/ecp/server/internal/service/lifecycle"
	oidcclientservice "github.com/xfzen/ecp/server/internal/service/oidcclient"
	policyservice "github.com/xfzen/ecp/server/internal/service/policy"
	registryservice "github.com/xfzen/ecp/server/internal/service/registry"
	securityconfigservice "github.com/xfzen/ecp/server/internal/service/securityconfig"
	sessionservice "github.com/xfzen/ecp/server/internal/service/session"

	"github.com/zeromicro/go-zero/rest"
	"gorm.io/gorm"
)

type ServiceContext struct {
	Config         config.Config
	DB             *gorm.DB
	Registry       *registryservice.Service
	Casdoor        *casdoor.Client
	OIDCClients    *oidcclientservice.Service
	Identity       *identityservice.Service
	Lifecycle      *lifecycleservice.Service
	Sessions       *sessionservice.Service
	Idempotency    *idempotencyservice.Service
	Access         *accessservice.Service
	Policy         *policyservice.Service
	SecurityConfig *securityconfigservice.Service
	Connector      *connectorservice.Service

	AdminSession       rest.Middleware
	CSRF               rest.Middleware
	IdempotencyHeaders rest.Middleware
	RateLimit          rest.Middleware
	ConnectorMachine   rest.Middleware
	OperatorMachine    rest.Middleware
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
		ctx.SecurityConfig = securityconfigservice.New(persistence.NewSecurityConfigStore(db))
		ctx.Connector = connectorservice.New(persistence.NewConnectorStore(db), envSecretProvider{}, connectorservice.Config{Issuer: cfg.Connector.Issuer, RootPublicKeyReference: cfg.Connector.RootPublicKeyReference, RootFingerprint: cfg.Connector.RootFingerprint, SigningPrivateKeyReference: cfg.Connector.SigningPrivateKeyReference, ActiveSigningKeyID: cfg.Connector.ActiveSigningKeyID, ClockSkew: cfg.Connector.ClockSkew})
	}
	ctx.AdminSession = asRestMiddleware(apiMiddleware.NewAdminSession(ctx.Sessions).Handle)
	ctx.CSRF = asRestMiddleware(apiMiddleware.NewCSRF().Handle)
	ctx.IdempotencyHeaders = asRestMiddleware(apiMiddleware.NewIdempotency(ctx.Idempotency).Handle)
	ctx.RateLimit = asRestMiddleware(apiMiddleware.NewRateLimit(30, time.Minute).Handle)
	ctx.ConnectorMachine = asRestMiddleware(apiMiddleware.NewConnectorMachine(connectorCredentialAdapter{service: ctx.Connector}).Handle)
	ctx.OperatorMachine = asRestMiddleware(apiMiddleware.NewOperatorMachine(operatorCredentialAdapter{service: ctx.Connector}).Handle)
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
	if ctx.DB != nil {
		ctx.Access = accessservice.New(persistence.NewAccessStore(ctx.DB), accessservice.NewCasdoorEngine(ctx.Casdoor), nil, nil)
		if ctx.Casdoor != nil {
			ctx.Policy = policyservice.New(persistence.NewPolicyStore(ctx.DB), ctx.Casdoor)
		}
	}
	return ctx
}

func asRestMiddleware(handle func(http.Handler) http.Handler) rest.Middleware {
	return func(next http.HandlerFunc) http.HandlerFunc { return handle(next).ServeHTTP }
}

type envSecretProvider struct{}

type identityPrincipalResolver struct{ service *identityservice.Service }
type connectorCredentialAdapter struct{ service *connectorservice.Service }
type operatorCredentialAdapter struct{ service *connectorservice.Service }

func (a connectorCredentialAdapter) VerifyConnectorCredential(ctx context.Context, id, secret string) (apiMiddleware.ConnectorClaims, error) {
	if a.service == nil {
		return apiMiddleware.ConnectorClaims{}, fmt.Errorf("connector service unavailable")
	}
	claims, err := a.service.AuthenticateInboundCredential(ctx, id, secret)
	if err != nil {
		return apiMiddleware.ConnectorClaims{}, err
	}
	return apiMiddleware.ConnectorClaims{ConnectorID: claims.ConnectorID, EnterpriseID: claims.EnterpriseID, ApplicationID: claims.ApplicationID, ApplicationInstanceID: claims.InstanceID, Channel: claims.Channel, Scopes: claims.Scopes}, nil
}

func (a operatorCredentialAdapter) VerifyOperatorCredential(ctx context.Context, id, secret string) (apiMiddleware.OperatorClaims, error) {
	if a.service == nil {
		return apiMiddleware.OperatorClaims{}, fmt.Errorf("connector service unavailable")
	}
	claims, err := a.service.AuthenticateKeySetOperator(ctx, id, secret)
	if err != nil {
		return apiMiddleware.OperatorClaims{}, err
	}
	return apiMiddleware.OperatorClaims{CredentialID: claims.ConnectorID, Scopes: claims.Scopes}, nil
}

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
