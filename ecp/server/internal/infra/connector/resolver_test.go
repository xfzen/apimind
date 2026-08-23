package connector

import (
	"context"
	"testing"

	"github.com/xfzen/ecp/server/internal/domain"
)

type resolverSecrets map[string]string

func (s resolverSecrets) Get(_ context.Context, reference string) ([]byte, error) {
	return []byte(s[reference]), nil
}

func TestResolverBindsOutboundCredentialToExactInstance(t *testing.T) {
	resolver, err := NewResolver([]ProductConfig{{InstanceID: "instance-1", BaseURL: "https://product.example.com", ClientID: "ecp-callback", SecretReference: "env://CALLBACK_SECRET"}}, resolverSecrets{"env://CALLBACK_SECRET": "secret"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := resolver.ResolveClient(context.Background(), domain.ApplicationInstance{Base: domain.Base{ID: "instance-1", EnterpriseID: "enterprise-1"}, Status: "active"}); err != nil {
		t.Fatal(err)
	}
	if _, err := resolver.ResolveClient(context.Background(), domain.ApplicationInstance{Base: domain.Base{ID: "instance-2", EnterpriseID: "enterprise-1"}, Status: "active"}); err == nil {
		t.Fatal("expected unknown instance rejection")
	}
}
