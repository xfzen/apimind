package casdoor

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

type OIDCVerifierConfig struct {
	Issuer, BackchannelBaseURL, ClientID, SecretReference string
	LocalMode                                             bool
	AllowedInsecureHosts                                  []string
}

type OIDCVerifier struct {
	config     OIDCVerifierConfig
	secrets    SecretProvider
	httpClient *http.Client
}

func NewOIDCVerifier(config OIDCVerifierConfig, secrets SecretProvider) (*OIDCVerifier, error) {
	issuer, err := parseOIDCEndpoint(config.Issuer, config.LocalMode, nil)
	if err != nil || !isLoopbackOrHTTPS(issuer, config.LocalMode) {
		return nil, adapterError("oidc_issuer_invalid", 0, err)
	}
	if config.ClientID == "" || config.SecretReference == "" || secrets == nil {
		return nil, adapterError("oidc_config_invalid", 0, nil)
	}
	config.Issuer = issuer.String()
	httpClient := http.DefaultClient
	if strings.TrimSpace(config.BackchannelBaseURL) != "" {
		backchannel, err := parseOIDCEndpoint(config.BackchannelBaseURL, config.LocalMode, config.AllowedInsecureHosts)
		if err != nil {
			return nil, adapterError("oidc_backchannel_invalid", 0, err)
		}
		config.BackchannelBaseURL = backchannel.String()
		httpClient = &http.Client{
			Transport: &issuerRewriteTransport{issuer: issuer, backchannel: backchannel, next: http.DefaultTransport},
			Timeout:   15 * time.Second,
		}
	}
	return &OIDCVerifier{config: config, secrets: secrets, httpClient: httpClient}, nil
}

func (v *OIDCVerifier) Verify(ctx context.Context, code, pkceVerifier, redirectURI string) (domain.VerifiedOIDCClaims, error) {
	if code == "" || pkceVerifier == "" || redirectURI == "" {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_exchange_invalid", 0, nil)
	}
	secret, err := v.secrets.Get(ctx, v.config.SecretReference)
	if err != nil || len(secret) == 0 {
		return domain.VerifiedOIDCClaims{}, adapterError("oidc_credential_unavailable", 0, err)
	}
	ctx = oidc.ClientContext(ctx, v.httpClient)
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

type issuerRewriteTransport struct {
	issuer, backchannel *url.URL
	next                http.RoundTripper
}

func (t *issuerRewriteTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if request.URL.Scheme != t.issuer.Scheme || !strings.EqualFold(request.URL.Host, t.issuer.Host) {
		return t.next.RoundTrip(request)
	}
	clone := request.Clone(request.Context())
	clone.URL.Scheme = t.backchannel.Scheme
	clone.URL.Host = t.backchannel.Host
	clone.URL.Path = joinURLPath(t.backchannel.Path, request.URL.Path)
	clone.Host = ""
	return t.next.RoundTrip(clone)
}

func parseOIDCEndpoint(raw string, localMode bool, allowedInsecureHosts []string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimRight(strings.TrimSpace(raw), "/"))
	if err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, fmt.Errorf("endpoint must be an absolute URL without credentials, query, or fragment")
	}
	if parsed.Scheme != "https" && !(localMode && parsed.Scheme == "http" && isAllowedInsecureHost(parsed.Hostname(), allowedInsecureHosts)) {
		return nil, fmt.Errorf("endpoint must use HTTPS")
	}
	return parsed, nil
}

func isLoopbackOrHTTPS(endpoint *url.URL, localMode bool) bool {
	return endpoint != nil && (endpoint.Scheme == "https" || (localMode && endpoint.Scheme == "http" && isLoopback(endpoint.Hostname())))
}

func joinURLPath(base, path string) string {
	return strings.TrimRight(base, "/") + "/" + strings.TrimLeft(path, "/")
}
