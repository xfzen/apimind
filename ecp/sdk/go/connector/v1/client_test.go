package connectorv1

import (
	"context"
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
