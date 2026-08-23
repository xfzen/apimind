package access

import (
	"context"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

type recordingCasdoorEnforcer struct {
	permissionID string
	request      []string
}

func (e *recordingCasdoorEnforcer) Enforce(_ context.Context, permissionID string, request []string) (bool, error) {
	e.permissionID = permissionID
	e.request = append([]string(nil), request...)
	return true, nil
}

func TestCasdoorEngineUsesPermissionResourceBinding(t *testing.T) {
	client := &recordingCasdoorEnforcer{}
	engine := NewCasdoorEngine(client)
	allowed, err := engine.Authorize(context.Background(), domain.AuthorizationRequest{
		PrincipalID: "principal-1", PolicySubject: "acme/alice", PermissionID: "acme/apimind-ins-1",
		ResourceType: "project", ResourceID: "project-1", Action: "project.read",
	})
	if err != nil || !allowed {
		t.Fatalf("allowed=%v err=%v", allowed, err)
	}
	if client.permissionID != "acme/apimind-ins-1" || len(client.request) != 3 || client.request[0] != "acme/alice" || client.request[1] != "project:project-1" || client.request[2] != "project.read" {
		t.Fatalf("permission=%q request=%v", client.permissionID, client.request)
	}
}
