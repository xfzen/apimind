package connector

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/service/productresource"
)

func TestSearchResourcesUsesOutboundTrustChannel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/enterprise/connector/v1/resources/search" {
			t.Fatalf("path = %s", request.URL.Path)
		}
		if request.Header.Get("X-ECP-Outbound-Client-ID") != "outbound-1" || request.Header.Get("Authorization") != "Bearer outbound-secret" || request.Header.Get("X-ECP-Audience") != "instance-a" {
			t.Error("missing outbound credential")
		}
		_ = json.NewEncoder(response).Encode(map[string]any{"resources": []map[string]any{{"type": "project", "id": "project-1", "display_name": "Visible", "version": 2}}})
	}))
	defer server.Close()
	client, err := NewClient(server.URL, OutboundCredential{ClientID: "outbound-1", Secret: "outbound-secret", Audience: "instance-a"}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	resources, err := client.SearchResources(context.Background(), domain.SignedDelegation{}, productresource.SearchInput{ResourceType: "project"})
	if err != nil {
		t.Fatal(err)
	}
	if len(resources) != 1 || resources[0].ExternalID != "project-1" || resources[0].ResourceVersion != 2 {
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
	_, err = client.ResolveResource(context.Background(), domain.SignedDelegation{}, productresource.ResourceInput{ResourceType: "project", ResourceID: "secret-project"})
	var denial *StableDenial
	if !errors.As(err, &denial) || denial.Error() != "resource_not_visible" {
		t.Fatalf("error = %v", err)
	}
}

func TestGetResourceAncestryPreservesComparableVersions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/enterprise/connector/v1/resources/ancestry" {
			t.Fatalf("path = %s", request.URL.Path)
		}
		_ = json.NewEncoder(response).Encode(map[string]any{"resources": []map[string]any{
			{"type": "project", "id": "20", "parent_id": "10", "version": 3},
			{"type": "workspace", "id": "10", "version": 2},
		}})
	}))
	defer server.Close()
	client, err := NewClient(server.URL, OutboundCredential{ClientID: "outbound-1", Secret: "outbound-secret", Audience: "instance-a"}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	resources, err := client.GetResourceAncestry(context.Background(), domain.SignedDelegation{}, productresource.ResourceInput{ResourceType: "project", ResourceID: "20"})
	if err != nil {
		t.Fatal(err)
	}
	if len(resources) != 2 || resources[0].ResourceVersion != 3 || resources[1].ResourceVersion != 2 {
		t.Fatalf("resources = %+v", resources)
	}
}

func TestApplyCompatibilityProjectionUsesOperationBoundCallback(t *testing.T) {
	payload := []byte(`{"schema_version":"apimind.compatibility.members/v1","members":[]}`)
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/api/enterprise/connector/v1/projections/members" {
			t.Fatalf("path = %s", request.URL.Path)
		}
		var body struct {
			OperationID string `json:"operation_id"`
			Payload     []byte `json:"payload"`
		}
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.OperationID != "operation-1" || !bytes.Equal(body.Payload, payload) {
			t.Fatalf("body=%+v", body)
		}
		_ = json.NewEncoder(response).Encode(map[string]any{"applied": true})
	}))
	defer server.Close()
	client, err := NewClient(server.URL, OutboundCredential{ClientID: "outbound-1", Secret: "outbound-secret", Audience: "instance-a"}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if err := client.ApplyCompatibilityProjection(context.Background(), domain.SignedDelegation{}, productresource.ProjectionInput{
		InstanceID: "instance-a", ResourceType: "project", ResourceID: "20", OperationID: "operation-1", PayloadHash: "hash", Payload: payload,
	}); err != nil {
		t.Fatal(err)
	}
}
