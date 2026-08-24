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
	var basicUser, basicPassword string
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		basicUser, basicPassword, _ = request.BasicAuth()
		response.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(response, `{"status":"ok","data":{"id":"user-1","name":"alice","isForbidden":false}}`)
	}))
	defer server.Close()

	client, err := NewClient(Config{
		BaseURL: server.URL, EnterpriseID: "ent-1", Organization: "acme", ClientID: "ecp-m2m", CredentialReference: "secret://casdoor/adapter", LocalMode: true,
	}, staticSecrets{"secret://casdoor/adapter": []byte("adapter-token")}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	user, err := client.GetUser(context.Background(), "user-1")
	if err != nil {
		t.Fatal(err)
	}
	if user.ID != "user-1" || basicUser != "ecp-m2m" || basicPassword != "adapter-token" {
		t.Fatalf("user=%+v basicUser=%q basicPasswordSet=%v", user, basicUser, basicPassword != "")
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

func TestClientAllowsExplicitComposeHostOnlyInLocalMode(t *testing.T) {
	base := Config{
		BaseURL: "http://casdoor:8000", EnterpriseID: "ent-1", Organization: "acme",
		ClientID: "ecp-m2m", CredentialReference: "secret://casdoor", AllowedInsecureHosts: []string{"casdoor"},
	}
	if _, err := NewClient(base, staticSecrets{}, http.DefaultClient); err == nil {
		t.Fatal("expected insecure endpoint rejection outside local mode")
	}
	base.LocalMode = true
	if _, err := NewClient(base, staticSecrets{}, http.DefaultClient); err != nil {
		t.Fatalf("explicit local Compose host was rejected: %v", err)
	}
	base.AllowedInsecureHosts = nil
	if _, err := NewClient(base, staticSecrets{}, http.DefaultClient); err == nil {
		t.Fatal("expected unlisted Compose host rejection")
	}
}

func TestOIDCVerifierRejectsNonHTTPSIssuerOutsideLocalMode(t *testing.T) {
	_, err := NewOIDCVerifier(OIDCVerifierConfig{Issuer: "http://idp.example.com", ClientID: "client", SecretReference: "env://OIDC_SECRET"}, staticSecrets{})
	if err == nil {
		t.Fatal("expected insecure issuer rejection")
	}
}

func TestOIDCVerifierUsesBackchannelBaseURLWithoutChangingIssuer(t *testing.T) {
	var receivedPath string
	backchannel := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		receivedPath = request.URL.Path
		response.WriteHeader(http.StatusNoContent)
	}))
	defer backchannel.Close()
	issuer := httptest.NewServer(http.NotFoundHandler())
	defer issuer.Close()

	verifier, err := NewOIDCVerifier(OIDCVerifierConfig{
		Issuer: issuer.URL, BackchannelBaseURL: backchannel.URL, ClientID: "client",
		SecretReference: "env://OIDC_SECRET", LocalMode: true,
	}, staticSecrets{})
	if err != nil {
		t.Fatal(err)
	}
	response, err := verifier.httpClient.Get(issuer.URL + "/.well-known/openid-configuration")
	if err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != http.StatusNoContent || receivedPath != "/.well-known/openid-configuration" {
		t.Fatalf("status=%d path=%q", response.StatusCode, receivedPath)
	}
}

func TestEnforceUsesDedicatedEnforcerIDAndTuple(t *testing.T) {
	var enforcerID, permissionID, body string
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		enforcerID = request.URL.Query().Get("enforcerId")
		permissionID = request.URL.Query().Get("permissionId")
		payload, _ := io.ReadAll(request.Body)
		body = string(payload)
		response.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(response, `{"status":"ok","data":[true]}`)
	}))
	defer server.Close()
	client, err := NewClient(Config{BaseURL: server.URL, EnterpriseID: "ent-1", Organization: "acme", ClientID: "ecp-m2m", CredentialReference: "secret://casdoor", LocalMode: true}, staticSecrets{"secret://casdoor": []byte("token")}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	allowed, err := client.Enforce(context.Background(), "acme/workspace-read", []string{"acme/alice", "workspace:1", "read"})
	if err != nil || !allowed || enforcerID != "acme/workspace-read" || permissionID != "" || body != `["acme/alice","workspace:1","read"]` {
		t.Fatalf("allowed=%v enforcer=%q permission=%q body=%q err=%v", allowed, enforcerID, permissionID, body, err)
	}
}

func TestClientIncludesBoundedProviderMessageInError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(response, `{"status":"error","msg":"the enforcer is not found"}`)
	}))
	defer server.Close()
	client, err := NewClient(Config{BaseURL: server.URL, EnterpriseID: "ent-1", Organization: "acme", ClientID: "ecp-m2m", CredentialReference: "secret://casdoor", LocalMode: true}, staticSecrets{"secret://casdoor": []byte("token")}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	err = client.WritePolicies(context.Background(), "acme/ecp-ins-1", []Policy{{PType: "p", V0: "alice", V1: "workspace:1", V2: "read"}})
	if err == nil || !strings.Contains(err.Error(), "the enforcer is not found") {
		t.Fatalf("provider message missing from error: %v", err)
	}
}

func TestPolicyOperationsUseOwnedEnforcerBoundary(t *testing.T) {
	var requests []string
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		payload, _ := io.ReadAll(request.Body)
		requests = append(requests, request.Method+" "+request.URL.RequestURI()+" "+string(payload))
		response.Header().Set("Content-Type", "application/json")
		if request.Method == http.MethodGet {
			_, _ = io.WriteString(response, `{"status":"ok","data":[{"ptype":"p","v0":"alice","v1":"workspace:1","v2":"read"}]}`)
			return
		}
		_, _ = io.WriteString(response, `{"status":"ok","data":true}`)
	}))
	defer server.Close()
	client, err := NewClient(Config{BaseURL: server.URL, EnterpriseID: "ent-1", Organization: "acme", ClientID: "ecp-m2m", CredentialReference: "secret://casdoor", LocalMode: true}, staticSecrets{"secret://casdoor": []byte("token")}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	policies, err := client.ReadPolicies(context.Background(), "acme/ecp-ins-1")
	if err != nil || len(policies) != 1 {
		t.Fatalf("policies=%+v err=%v", policies, err)
	}
	policy := Policy{PType: "p", V0: "alice", V1: "workspace:1", V2: "read"}
	if err := client.WritePolicies(context.Background(), "acme/ecp-ins-1", []Policy{policy}); err != nil {
		t.Fatal(err)
	}
	if err := client.DeletePolicies(context.Background(), "acme/ecp-ins-1", []Policy{policy}); err != nil {
		t.Fatal(err)
	}
	want := []string{
		"GET /api/get-policies?id=acme%2Fecp-ins-1 ",
		`POST /api/add-policy?id=acme%2Fecp-ins-1 {"ptype":"p","v0":"alice","v1":"workspace:1","v2":"read"}`,
		`POST /api/remove-policy?id=acme%2Fecp-ins-1 {"ptype":"p","v0":"alice","v1":"workspace:1","v2":"read"}`,
	}
	if strings.Join(requests, "\n") != strings.Join(want, "\n") {
		t.Fatalf("requests:\n%s", strings.Join(requests, "\n"))
	}
	if _, err := client.ReadPolicies(context.Background(), "other/ecp-ins-1"); err == nil {
		t.Fatal("expected cross-organization boundary rejection")
	}
}

func TestEnsureAuthorizationBoundaryCreatesDedicatedObjectsInOrder(t *testing.T) {
	var requests []string
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		payload, _ := io.ReadAll(request.Body)
		requests = append(requests, request.Method+" "+request.URL.Path+" "+string(payload))
		response.Header().Set("Content-Type", "application/json")
		if request.Method == http.MethodGet {
			_, _ = io.WriteString(response, `{"status":"ok","data":null}`)
			return
		}
		_, _ = io.WriteString(response, `{"status":"ok","data":true}`)
	}))
	defer server.Close()
	client, err := NewClient(Config{BaseURL: server.URL, EnterpriseID: "ent-1", Organization: "acme", ClientID: "ecp-m2m", CredentialReference: "secret://casdoor", LocalMode: true}, staticSecrets{"secret://casdoor": []byte("token")}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if err := client.EnsureAuthorizationBoundary(context.Background(), AuthorizationBoundary{Name: "ecp-apimind-local", Table: "ecp_policy_1234"}); err != nil {
		t.Fatal(err)
	}
	var paths []string
	for _, request := range requests {
		parts := strings.SplitN(request, " ", 3)
		paths = append(paths, parts[0]+" "+parts[1])
	}
	want := []string{"GET /api/get-model", "POST /api/add-model", "GET /api/get-adapter", "POST /api/add-adapter", "GET /api/get-enforcer", "POST /api/add-enforcer", "GET /api/get-permission", "POST /api/add-permission"}
	if strings.Join(paths, "\n") != strings.Join(want, "\n") {
		t.Fatalf("paths:\n%s", strings.Join(paths, "\n"))
	}
	if !strings.Contains(requests[3], `"table":"ecp_policy_1234"`) || !strings.Contains(requests[7], `"resourceType":"Application"`) {
		t.Fatalf("boundary payloads missing dedicated adapter or permission: %+v", requests)
	}
}
