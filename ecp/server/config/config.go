package config

import (
	"time"

	"github.com/zeromicro/go-zero/rest"
)

type Config struct {
	rest.RestConf
	Build     BuildConfig
	Database  DatabaseConfig  `json:",optional"`
	Casdoor   CasdoorConfig   `json:",optional"`
	OIDC      OIDCConfig      `json:",optional"`
	Identity  IdentityConfig  `json:",optional"`
	Session   SessionConfig   `json:",optional"`
	Connector ConnectorConfig `json:",optional"`
	Audit     AuditConfig     `json:",optional"`
}

type ConnectorConfig struct {
	Issuer                     string        `json:",default=ecp"`
	RootPublicKeyReference     string        `json:",optional"`
	RootFingerprint            string        `json:",optional"`
	SigningPrivateKeyReference string        `json:",optional"`
	ActiveSigningKeyID         string        `json:",optional"`
	ClockSkew                  time.Duration `json:",default=30s"`
}

type CasdoorConfig struct {
	Enabled             bool   `json:",default=false"`
	BaseURL             string `json:",optional"`
	EnterpriseID        string `json:",optional"`
	Organization        string `json:",optional"`
	CredentialReference string `json:",optional"`
	LocalMode           bool   `json:",default=false"`
}

type OIDCConfig struct {
	LocalMode             bool   `json:",default=false"`
	AdminAudience         string `json:",optional"`
	Issuer                string `json:",optional"`
	AuthorizationEndpoint string `json:",optional"`
	ClientID              string `json:",optional"`
	SecretReference       string `json:",optional"`
}

type IdentityConfig struct {
	TrustedIssuers []string      `json:",optional"`
	FreshnessTTL   time.Duration `json:",default=5m"`
}

type SessionConfig struct {
	TTL time.Duration `json:",default=8h"`
}

type DatabaseConfig struct {
	Enabled         bool          `json:",default=false"`
	Driver          string        `json:",optional"`
	DSN             string        `json:",optional"`
	MaxOpenConns    int           `json:",default=20"`
	MaxIdleConns    int           `json:",default=5"`
	ConnMaxLifetime time.Duration `json:",default=30m"`
}

type BuildConfig struct {
	Version string
}
