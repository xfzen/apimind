package connectorv1

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHealthUsesVersionedPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v1/meta/health" {
			t.Fatalf("path = %s", request.URL.Path)
		}
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"status":"ok","version":"dev"}`))
	}))
	defer server.Close()
	client, err := NewClient(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	health, err := client.Health(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if health.Status != "ok" {
		t.Fatalf("health = %#v", health)
	}
}

func TestClientRejectsRemotePlainHTTP(t *testing.T) {
	if _, err := NewClient("http://ecp.example.com", nil); err == nil {
		t.Fatal("expected insecure remote URL rejection")
	}
}

func TestConnectorCallsUseMachineCredential(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v1/connector/heartbeat" {
			t.Errorf("path = %s", request.URL.Path)
		}
		if request.Header.Get("X-ECP-Connector-ID") != "connector-1" || request.Header.Get("Authorization") != "Bearer secret" {
			t.Error("machine credential missing")
		}
		_ = json.NewEncoder(response).Encode(map[string]any{})
	}))
	defer server.Close()
	client, err := NewClient(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if err := client.WithCredential(ConnectorCredential{ConnectorID: "connector-1", Secret: "secret"}).Heartbeat(context.Background(), HeartbeatRequest{InstanceID: "instance-a"}); err != nil {
		t.Fatal(err)
	}
}

func TestProductLoginUsesSnakeCaseWireContractAndUnixTime(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v1/connector/auth/start" {
			t.Fatalf("path = %s", request.URL.Path)
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["application_instance_id"] != "instance-a" || body["redirect_uri"] != "https://product.example.com/api/enterprise/auth/callback" {
			t.Fatalf("body = %#v", body)
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"transaction_id":"tx-1","state":"state","pkce_verifier":"verifier","nonce":"nonce","authorization_url":"https://id.example.com/auth","expires_at":1787443200}`))
	}))
	defer server.Close()
	client, err := NewClient(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	result, err := client.BeginProductLogin(context.Background(), ProductLoginStartRequest{EnterpriseID: "enterprise-1", ApplicationInstanceID: "instance-a", RedirectURI: "https://product.example.com/api/enterprise/auth/callback"})
	if err != nil {
		t.Fatal(err)
	}
	if result.TransactionID != "tx-1" || result.ExpiresAt.Unix() != 1787443200 {
		t.Fatalf("result = %+v", result)
	}
}

func TestAuthenticateServiceCredentialUsesConnectorChannelAndReturnsSharedDecision(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v1/connector/service-credentials/authenticate" {
			t.Fatalf("path = %s", request.URL.Path)
		}
		if request.Header.Get("X-ECP-Connector-ID") != "connector-1" || request.Header.Get("Authorization") != "Bearer connector-secret" {
			t.Fatal("connector credential missing")
		}
		var body ServiceCredentialAuthorizationRequest
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Credential != "cred-1.secret" || body.ResourceType != "project" || body.ResourceID != "project-1" || body.Action != "project.read" || body.ResourceVersion != 7 {
			t.Fatalf("body=%+v", body)
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"principal_id":"cred-1","decision":{"allow":true,"reason":"allowed","policy_version":3,"authorized_resource_version":7}}`))
	}))
	defer server.Close()
	client, err := NewClient(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	result, err := client.WithCredential(ConnectorCredential{ConnectorID: "connector-1", Secret: "connector-secret"}).AuthenticateServiceCredential(context.Background(), ServiceCredentialAuthorizationRequest{Credential: "cred-1.secret", ResourceType: "project", ResourceID: "project-1", Action: "project.read", ResourceVersion: 7})
	if err != nil {
		t.Fatal(err)
	}
	if result.PrincipalID != "cred-1" || !result.Decision.Allow || result.Decision.PolicyVersion != 3 || result.Decision.AuthorizedResourceVersion != 7 {
		t.Fatalf("result=%+v", result)
	}
}

func TestGetDelegationKeySetPreservesSignedEnvelopeForVerification(t *testing.T) {
	rootPublic, rootPrivate, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	onlinePublic, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 24, 0, 0, 0, 0, time.UTC)
	signed, err := SignKeySet(rootPrivate, KeySet{Version: 1, Purpose: KeySetPurposeDelegation, SigningKeyID: "root-1", Keys: []VerificationKey{{KeyID: "online-1", Algorithm: AlgorithmEdDSA, PublicKey: base64.RawURLEncoding.EncodeToString(onlinePublic), NotBefore: now.Add(-time.Minute), NotAfter: now.Add(time.Hour), Status: KeyStatusActive}}})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/v1/connector/signing-keys/delegation" {
			t.Fatalf("path=%s", request.URL.Path)
		}
		response.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(response).Encode(signed)
	}))
	defer server.Close()
	client, err := NewClient(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	received, err := client.GetDelegationKeySet(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	verified, err := VerifyKeySet(rootPublic, received, nil, now)
	if err != nil || verified.Version != 1 || verified.Keys[0].KeyID != "online-1" {
		t.Fatalf("verified=%+v err=%v", verified, err)
	}
}
