package connectorv1

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
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
