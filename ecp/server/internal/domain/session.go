package domain

import "time"

const (
	SessionKindAdmin   = "admin"
	SessionKindProduct = "product"
)

type VerifiedOIDCClaims struct{ Issuer, Subject, PrincipalID, Audience, Nonce string }

type LoginTransaction struct {
	Base
	OIDCClientID          string     `gorm:"column:oidc_client_id;type:varchar(36);not null"`
	ApplicationInstanceID string     `gorm:"column:application_instance_id;type:varchar(36)"`
	Kind                  string     `gorm:"column:kind;type:varchar(32);not null"`
	StateHash             string     `gorm:"column:state_hash;type:char(64);not null"`
	PKCEVerifierHash      string     `gorm:"column:pkce_verifier_hash;type:char(64);not null"`
	NonceHash             string     `gorm:"column:nonce_hash;type:char(64);not null"`
	RedirectURI           string     `gorm:"column:redirect_uri;type:varchar(512);not null"`
	ExpiresAt             time.Time  `gorm:"column:expires_at;precision:6;not null"`
	UsedAt                *time.Time `gorm:"column:used_at;precision:6"`
}

func (LoginTransaction) TableName() string { return "login_transactions" }

type ProductLoginTransaction struct {
	Base
	ApplicationInstanceID string     `gorm:"column:application_instance_id;type:varchar(36);not null"`
	PrincipalID           string     `gorm:"column:principal_id;type:varchar(36);not null"`
	CodeHash              string     `gorm:"column:code_hash;type:char(64);not null"`
	ExpiresAt             time.Time  `gorm:"column:expires_at;precision:6;not null"`
	UsedAt                *time.Time `gorm:"column:used_at;precision:6"`
}

func (ProductLoginTransaction) TableName() string { return "product_login_transactions" }

type Session struct {
	Base
	PrincipalID           string     `gorm:"column:principal_id;type:varchar(36);not null"`
	ApplicationInstanceID string     `gorm:"column:application_instance_id;type:varchar(36)"`
	Kind                  string     `gorm:"column:kind;type:varchar(32);not null"`
	TokenHash             string     `gorm:"column:token_hash;type:char(64);not null"`
	CSRFHash              string     `gorm:"column:csrf_hash;type:char(64);not null"`
	ExpiresAt             time.Time  `gorm:"column:expires_at;precision:6;not null"`
	RevokedAt             *time.Time `gorm:"column:revoked_at;precision:6"`
	Version               uint64     `gorm:"column:version;not null"`
	Token                 string     `gorm:"-"`
	CSRFToken             string     `gorm:"-"`
	CookieName            string     `gorm:"-"`
}

func (Session) TableName() string { return "sessions" }
