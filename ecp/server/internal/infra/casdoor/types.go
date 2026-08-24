package casdoor

import (
	"context"
	"net/http"
)

type SecretProvider interface {
	Get(ctx context.Context, reference string) ([]byte, error)
}

type Config struct {
	BaseURL              string
	EnterpriseID         string
	Organization         string
	ClientID             string
	CredentialReference  string
	LocalMode            bool
	AllowedInsecureHosts []string
}

type User struct {
	ID          string `json:"id"`
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	IsForbidden bool   `json:"isForbidden"`
}

type Policy struct {
	Owner string `json:"-"`
	Name  string `json:"-"`
	PType string `json:"ptype"`
	V0    string `json:"v0"`
	V1    string `json:"v1"`
	V2    string `json:"v2"`
	V3    string `json:"v3,omitempty"`
	V4    string `json:"v4,omitempty"`
	V5    string `json:"v5,omitempty"`
}

type Model struct {
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
	ModelText   string `json:"modelText"`
}

type Adapter struct {
	Owner        string `json:"owner"`
	Name         string `json:"name"`
	Table        string `json:"table"`
	UseSameDB    bool   `json:"useSameDb"`
	Type         string `json:"type"`
	DatabaseType string `json:"databaseType"`
}

type Enforcer struct {
	Owner       string `json:"owner"`
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
	Model       string `json:"model"`
	Adapter     string `json:"adapter"`
}

type Permission struct {
	Owner        string   `json:"owner"`
	Name         string   `json:"name"`
	DisplayName  string   `json:"displayName"`
	Description  string   `json:"description"`
	Users        []string `json:"users"`
	Groups       []string `json:"groups"`
	Roles        []string `json:"roles"`
	Domains      []string `json:"domains"`
	Model        string   `json:"model"`
	Adapter      string   `json:"adapter"`
	ResourceType string   `json:"resourceType"`
	Resources    []string `json:"resources"`
	Actions      []string `json:"actions"`
	Effect       string   `json:"effect"`
	IsEnabled    bool     `json:"isEnabled"`
}

type AuthorizationBoundary struct {
	Name  string
	Table string
}

type Client struct {
	baseURL      string
	enterpriseID string
	organization string
	clientID     string
	credential   string
	secrets      SecretProvider
	httpClient   *http.Client
}
