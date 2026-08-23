package casdoor

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type staticSecrets map[string][]byte

func (s staticSecrets) Get(_ context.Context, reference string) ([]byte, error) {
	return append([]byte(nil), s[reference]...), nil
}

func TestClientResolvesCredentialWithoutPersistingIt(t *testing.T) {
	var authorization string
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		authorization = request.Header.Get("Authorization")
		response.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(response, `{"status":"ok","data":{"id":"user-1","name":"alice","isForbidden":false}}`)
	}))
	defer server.Close()

	client, err := NewClient(Config{
		BaseURL: server.URL, EnterpriseID: "ent-1", Organization: "acme", CredentialReference: "secret://casdoor/adapter", LocalMode: true,
	}, staticSecrets{"secret://casdoor/adapter": []byte("adapter-token")}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	user, err := client.GetUser(context.Background(), "user-1")
	if err != nil {
		t.Fatal(err)
	}
	if user.ID != "user-1" || authorization != "Bearer adapter-token" {
		t.Fatalf("user=%+v authorization=%q", user, authorization)
	}
	if strings.Contains(client.String(), "adapter-token") {
		t.Fatal("client diagnostics exposed adapter credential")
	}
}

func TestClientRejectsNonHTTPSOutsideLocalMode(t *testing.T) {
	_, err := NewClient(Config{BaseURL: "http://casdoor.example.com", EnterpriseID: "ent-1", Organization: "acme", CredentialReference: "secret://casdoor"}, staticSecrets{}, http.DefaultClient)
	if err == nil {
		t.Fatal("expected insecure endpoint rejection")
	}
}

func TestOIDCVerifierRejectsNonHTTPSIssuerOutsideLocalMode(t *testing.T) {
	_, err := NewOIDCVerifier(OIDCVerifierConfig{Issuer: "http://idp.example.com", ClientID: "client", SecretReference: "env://OIDC_SECRET"}, staticSecrets{})
	if err == nil {
		t.Fatal("expected insecure issuer rejection")
	}
}
