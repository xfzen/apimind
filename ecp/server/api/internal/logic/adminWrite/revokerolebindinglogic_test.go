package adminWrite

import (
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

func TestCanSelfRevokeOnlyOwnPrincipalBinding(t *testing.T) {
	own := domain.RoleBinding{SubjectType: "principal", SubjectID: "principal-1"}
	if !canSelfRevoke(own, "principal-1") {
		t.Fatal("own principal binding should be revocable without resolving an orphaned resource")
	}
	for _, value := range []domain.RoleBinding{
		{SubjectType: "principal", SubjectID: "principal-2"},
		{SubjectType: "group", SubjectID: "principal-1"},
	} {
		if canSelfRevoke(value, "principal-1") {
			t.Fatalf("binding must still require resource authorization: %+v", value)
		}
	}
}
