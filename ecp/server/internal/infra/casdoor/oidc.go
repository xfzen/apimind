package casdoor

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/xfzen/ecp/server/internal/domain"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type OIDCVerifierConfig struct {
	Issuer, ClientID, SecretReference string
	LocalMode                         bool
}

type OIDCVerifier struct {
	config  OIDCVerifierConfig
	secrets SecretProvider
}

func NewOIDCVerifier(config OIDCVerifierConfig, secrets SecretProvider) (*OIDCVerifier, error) {
	issuer, err := url.Parse(strings.TrimRight(strings.TrimSpace(config.Issuer), "/"))
	if err != nil || issuer.Host == "" || (issuer.Scheme != "https" && !(config.LocalMode && issuer.Scheme == "http" && isLoopback(issuer.Hostname()))) {
		return nil, adapterError("oidc_issuer_invalid", 0, err)
	}
	if config.ClientID == "" || config.SecretReference == "" || secrets == nil {
		return nil, adapterError("oidc_config_invalid", 0, nil)
	}
	config.Issuer = issuer.String()
	return &OIDCVerifier{config: config, secrets: secrets}, nil
}

func (v *OIDCVerifier) Verify(ctx context.Context, code, pkceVerifier, redirectURI string) (domain.VerifiedOIDCClaims, error) {
	if code == "" || pkceVerifier == "" || redirectURI == "" {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_exchange_invalid", 0, nil)
	}
	secret, err := v.secrets.Get(ctx, v.config.SecretReference)
	if err != nil || len(secret) == 0 {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_credential_unavailable", 0, err)
	}
	provider, err := oidc.NewProvider(ctx, v.config.Issuer)
	if err != nil {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_discovery_failed", 0, err)
	}
	oauthConfig := oauth2.Config{ClientID: v.config.ClientID, ClientSecret: string(secret), Endpoint: provider.Endpoint(), RedirectURL: redirectURI, Scopes: []string{oidc.ScopeOpenID, "profile", "email"}}
	token, err := oauthConfig.Exchange(ctx, code, oauth2.VerifierOption(pkceVerifier))
	if err != nil {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_exchange_failed", 0, err)
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_id_token_missing", 0, nil)
	}
	idToken, err := provider.Verifier(&oidc.Config{ClientID: v.config.ClientID}).Verify(ctx, rawIDToken)
	if err != nil {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_id_token_invalid", 0, err)
	}
	var claims struct {
		Issuer   string `json:"iss"`
		Subject  string `json:"sub"`
		Nonce    string `json:"nonce"`
		Audience any    `json:"aud"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_claims_invalid", 0, err)
	}
	if claims.Issuer != v.config.Issuer || claims.Subject == "" || claims.Nonce == "" {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_claims_invalid", 0, fmt.Errorf("required claims missing"))
	}
	audience := ""
	switch value := claims.Audience.(type) {
	case string:
		audience = value
	case []any:
		for _, item := range value {
			if candidate, ok := item.(string); ok && candidate == v.config.ClientID {
				audience = candidate
				break
			}
		}
	}
	return domain.VerifiedOIDCClaims{Issuer: claims.Issuer, Subject: claims.Subject, Audience: audience, Nonce: claims.Nonce}, nil
}
