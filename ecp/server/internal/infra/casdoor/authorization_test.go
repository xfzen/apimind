package casdoor

import (
	"net/url"
	"testing"
)

func TestBuildAuthorizationURLBindsPKCEStateNonceAndExactRedirect(t *testing.T) {
	raw, err := BuildAuthorizationURL(AuthorizationRequest{
		Endpoint: "https://id.example.com/login/oauth/authorize", ClientID: "product-client",
		RedirectURI: "https://product.example.com/api/enterprise/auth/callback", State: "state", Nonce: "nonce", CodeChallenge: "challenge",
	})
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	for key, want := range map[string]string{
		"client_id": "product-client", "redirect_uri": "https://product.example.com/api/enterprise/auth/callback",
		"state": "state", "nonce": "nonce", "code_challenge": "challenge", "code_challenge_method": "S256",
	} {
		if got := parsed.Query().Get(key); got != want {
			t.Fatalf("%s = %q, want %q", key, got, want)
		}
	}
}

func TestBuildAuthorizationURLRejectsRemoteHTTP(t *testing.T) {
	_, err := BuildAuthorizationURL(AuthorizationRequest{Endpoint: "http://id.example.com/auth", ClientID: "client", RedirectURI: "https://product.example.com/callback", State: "state", Nonce: "nonce", CodeChallenge: "challenge"})
	if err == nil {
		t.Fatal("expected remote HTTP rejection")
	}
}
