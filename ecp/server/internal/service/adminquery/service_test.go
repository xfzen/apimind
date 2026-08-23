package adminquery

import (
	"context"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

type fakeStore struct{ principals []domain.Principal }

func (f fakeStore) ListPrincipals(_ context.Context, enterpriseID string) ([]domain.Principal, error) {
	var result []domain.Principal
	for _, value := range f.principals {
		if value.EnterpriseID == enterpriseID {
			result = append(result, value)
		}
	}
	return result, nil
}

func TestListPrincipalsIsEnterpriseScoped(t *testing.T) {
	service := New(fakeStore{principals: []domain.Principal{{Base: domain.Base{ID: "p1", EnterpriseID: "ent-1"}}, {Base: domain.Base{ID: "p2", EnterpriseID: "ent-2"}}}})
	values, err := service.ListPrincipals(context.Background(), "ent-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(values) != 1 || values[0].ID != "p1" {
		t.Fatalf("unexpected principals: %+v", values)
	}
}
