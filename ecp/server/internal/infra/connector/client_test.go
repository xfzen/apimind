package connector

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

func TestSearchResourcesUsesOutboundTrustChannel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("X-ECP-Outbound-Client-ID") != "outbound-1" || request.Header.Get("Authorization") != "Bearer outbound-secret" || request.Header.Get("X-ECP-Audience") != "instance-a" {
			t.Error("missing outbound credential")
		}
		_ = json.NewEncoder(response).Encode(ResourceSearchResponse{Resources: []ResourceResult{{Type: "project", ID: "project-1", DisplayName: "Visible"}}})
	}))
	defer server.Close()
	client, err := NewClient(server.URL, OutboundCredential{ClientID: "outbound-1", Secret: "outbound-secret", Audience: "instance-a"}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	resources, err := client.SearchResources(context.Background(), ResourceSearchRequest{Delegation: domain.SignedDelegation{}, ResourceType: "project"})
	if err != nil {
		t.Fatal(err)
	}
	if len(resources) != 1 || resources[0].ID != "project-1" {
		t.Fatalf("resources = %+v", resources)
	}
}

func TestUnauthorizedResourceUsesStableDenial(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.WriteHeader(http.StatusNotFound)
		_, _ = response.Write([]byte(`secret-project`))
	}))
	defer server.Close()
	client, err := NewClient(server.URL, OutboundCredential{ClientID: "outbound-1", Secret: "outbound-secret", Audience: "instance-a"}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.ResolveResource(context.Background(), domain.SignedDelegation{}, "project", "secret-project")
	var denial *StableDenial
	if !errors.As(err, &denial) || denial.Error() != "resource_not_visible" {
		t.Fatalf("error = %v", err)
	}
}
