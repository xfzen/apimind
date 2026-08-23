package casdoor

import (
	"context"
	"net/http"
)

type SecretProvider interface {
	Get(ctx context.Context, reference string) ([]byte, error)
}

type Config struct {
	BaseURL             string
	EnterpriseID        string
	Organization        string
	CredentialReference string
	LocalMode           bool
}

type User struct {
	ID          string `json:"id"`
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	IsForbidden bool   `json:"isForbidden"`
}

type Policy struct {
	Owner string `json:"owner"`
	Name  string `json:"name"`
	PType string `json:"ptype"`
	V0    string `json:"v0"`
	V1    string `json:"v1"`
	V2    string `json:"v2"`
	V3    string `json:"v3,omitempty"`
	V4    string `json:"v4,omitempty"`
	V5    string `json:"v5,omitempty"`
}

type Client struct {
	baseURL      string
	enterpriseID string
	organization string
	credential   string
	secrets      SecretProvider
	httpClient   *http.Client
}
