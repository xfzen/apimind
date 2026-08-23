package casdoor

import (
	"fmt"
	"net/url"
	"strings"
)

type AuthorizationRequest struct {
	Endpoint, ClientID, RedirectURI, State, Nonce, CodeChallenge string
	LocalMode                                                    bool
}

func BuildAuthorizationURL(input AuthorizationRequest) (string, error) {
	endpoint, err := url.Parse(strings.TrimSpace(input.Endpoint))
	if err != nil || endpoint.Host == "" || endpoint.User != nil || endpoint.RawQuery != "" || endpoint.Fragment != "" {
		return "", fmt.Errorf("oidc authorization endpoint is invalid")
	}
	if endpoint.Scheme != "https" && !(input.LocalMode && endpoint.Scheme == "http" && isLoopback(endpoint.Hostname())) {
		return "", fmt.Errorf("oidc authorization endpoint must use HTTPS")
	}
	if input.ClientID == "" || input.RedirectURI == "" || input.State == "" || input.Nonce == "" || input.CodeChallenge == "" {
		return "", fmt.Errorf("oidc authorization request is incomplete")
	}
	query := endpoint.Query()
	query.Set("client_id", input.ClientID)
	query.Set("redirect_uri", input.RedirectURI)
	query.Set("response_type", "code")
	query.Set("scope", "openid profile email")
	query.Set("state", input.State)
	query.Set("nonce", input.Nonce)
	query.Set("code_challenge", input.CodeChallenge)
	query.Set("code_challenge_method", "S256")
	endpoint.RawQuery = query.Encode()
	return endpoint.String(), nil
}
