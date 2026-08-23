package connector

import (
	"context"
	"fmt"
	"net/http"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/service/productresource"
)

type ProductConfig struct {
	InstanceID, BaseURL, ClientID, SecretReference string
}

type SecretProvider interface {
	Get(context.Context, string) ([]byte, error)
}

type Resolver struct {
	products   map[string]ProductConfig
	secrets    SecretProvider
	httpClient *http.Client
}

func NewResolver(configs []ProductConfig, secrets SecretProvider, httpClient *http.Client) (*Resolver, error) {
	if secrets == nil {
		return nil, fmt.Errorf("product connector secret provider unavailable")
	}
	products := make(map[string]ProductConfig, len(configs))
	for _, config := range configs {
		if config.InstanceID == "" || config.BaseURL == "" || config.ClientID == "" || config.SecretReference == "" {
			return nil, fmt.Errorf("product connector configuration incomplete")
		}
		if _, found := products[config.InstanceID]; found {
			return nil, fmt.Errorf("duplicate product connector instance")
		}
		products[config.InstanceID] = config
	}
	return &Resolver{products: products, secrets: secrets, httpClient: httpClient}, nil
}

func (r *Resolver) ResolveClient(ctx context.Context, instance domain.ApplicationInstance) (productresource.ProductClient, error) {
	if r == nil || instance.ID == "" || instance.Status != "active" {
		return nil, fmt.Errorf("product connector instance unavailable")
	}
	config, found := r.products[instance.ID]
	if !found || config.InstanceID != instance.ID {
		return nil, fmt.Errorf("product connector instance unavailable")
	}
	secret, err := r.secrets.Get(ctx, config.SecretReference)
	if err != nil || len(secret) == 0 {
		return nil, fmt.Errorf("product connector credential unavailable")
	}
	return NewClient(config.BaseURL, OutboundCredential{ClientID: config.ClientID, Secret: string(secret), Audience: instance.ID}, r.httpClient)
}
