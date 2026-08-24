package connectorMachine

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/xfzen/ecp/server/api/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func TestAuthorizationRequestAcceptsServerOwnedIdentityFieldsAsAbsent(t *testing.T) {
	body := `{"requests":[{"enterprise_id":"enterprise-1","application_instance_id":"instance-1","principal_id":"principal-1","action":"workspace.member.manage","resource_type":"workspace","resource_id":"261","resource_version":1}]}`
	request := httptest.NewRequest("POST", "/api/v1/access/batch", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")

	var value types.BatchAuthorizeReq
	if err := httpx.Parse(request, &value); err != nil {
		t.Fatalf("parse minimal authorization request: %v", err)
	}
	if len(value.Requests) != 1 || value.Requests[0].PrincipalID != "principal-1" {
		t.Fatalf("unexpected parsed request: %#v", value)
	}
}
