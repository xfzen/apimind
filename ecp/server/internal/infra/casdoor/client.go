package casdoor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"reflect"
	"strings"
)

const authorizationModelText = `[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = (r.sub == p.sub || g(r.sub, p.sub)) && r.obj == p.obj && r.act == p.act`

func NewClient(cfg Config, secrets SecretProvider, httpClient *http.Client) (*Client, error) {
	parsed, err := url.Parse(cfg.BaseURL)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && !(cfg.LocalMode && parsed.Scheme == "http" && isAllowedInsecureHost(parsed.Hostname(), cfg.AllowedInsecureHosts))) {
		return nil, adapterError("casdoor_endpoint_invalid", 0, err)
	}
	if cfg.EnterpriseID == "" || cfg.Organization == "" || cfg.ClientID == "" || cfg.CredentialReference == "" || secrets == nil {
		return nil, adapterError("casdoor_config_invalid", 0, nil)
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		baseURL: strings.TrimRight(parsed.String(), "/"), enterpriseID: cfg.EnterpriseID,
		organization: cfg.Organization, clientID: cfg.ClientID, credential: cfg.CredentialReference, secrets: secrets, httpClient: httpClient,
	}, nil
}

func (c *Client) String() string {
	return fmt.Sprintf("casdoor.Client{baseURL:%q, enterpriseID:%q, organization:%q, credentialReference:%q}", c.baseURL, c.enterpriseID, c.organization, c.credential)
}

func (c *Client) GetUser(ctx context.Context, id string) (User, error) {
	var response struct {
		Status string `json:"status"`
		Msg    string `json:"msg"`
		Data   User   `json:"data"`
	}
	err := c.do(ctx, http.MethodGet, "/api/get-user", url.Values{"id": []string{id}, "owner": []string{c.organization}}, nil, &response)
	return response.Data, err
}

func (c *Client) DisableUser(ctx context.Context, id string) error {
	return c.do(ctx, http.MethodPost, "/api/update-user", nil, map[string]any{
		"owner": c.organization, "id": id, "isForbidden": true,
	}, nil)
}

func (c *Client) ListDirectGroupMembers(ctx context.Context, group string) ([]User, error) {
	var response struct {
		Data []User `json:"data"`
	}
	err := c.do(ctx, http.MethodGet, "/api/get-users", url.Values{"owner": []string{c.organization}, "group": []string{group}}, nil, &response)
	return response.Data, err
}

func (c *Client) ReadPolicies(ctx context.Context, enforcerID string) ([]Policy, error) {
	if !c.ownedID(enforcerID) {
		return nil, adapterError("casdoor_boundary_invalid", 0, nil)
	}
	var response struct {
		Data []Policy `json:"data"`
	}
	err := c.do(ctx, http.MethodGet, "/api/get-policies", url.Values{"id": []string{enforcerID}}, nil, &response)
	return response.Data, err
}

func (c *Client) WritePolicies(ctx context.Context, enforcerID string, policies []Policy) error {
	if !c.ownedID(enforcerID) {
		return adapterError("casdoor_boundary_invalid", 0, nil)
	}
	for _, policy := range policies {
		if err := c.do(ctx, http.MethodPost, "/api/add-policy", url.Values{"id": []string{enforcerID}}, policy, nil); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) DeletePolicies(ctx context.Context, enforcerID string, policies []Policy) error {
	if !c.ownedID(enforcerID) {
		return adapterError("casdoor_boundary_invalid", 0, nil)
	}
	for _, policy := range policies {
		if err := c.do(ctx, http.MethodPost, "/api/remove-policy", url.Values{"id": []string{enforcerID}}, policy, nil); err != nil {
			return err
		}
	}
	return nil
}

func (c *Client) EnsureAuthorizationBoundary(ctx context.Context, boundary AuthorizationBoundary) error {
	if strings.TrimSpace(boundary.Name) == "" || strings.TrimSpace(boundary.Table) == "" || strings.ContainsAny(boundary.Name, "/\\") {
		return adapterError("casdoor_boundary_invalid", 0, nil)
	}
	owner := c.organization
	id := owner + "/" + boundary.Name
	model := Model{Owner: owner, Name: boundary.Name, DisplayName: "ECP " + boundary.Name, Description: "Managed by ECP", ModelText: authorizationModelText}
	adapter := Adapter{Owner: owner, Name: boundary.Name, Table: boundary.Table, UseSameDB: true, Type: "Database", DatabaseType: ""}
	enforcer := Enforcer{Owner: owner, Name: boundary.Name, DisplayName: "ECP " + boundary.Name, Description: "Managed by ECP", Model: id, Adapter: id}
	permission := Permission{Owner: owner, Name: boundary.Name, DisplayName: "ECP " + boundary.Name, Description: "Managed by ECP", Users: []string{}, Groups: []string{}, Roles: []string{}, Domains: []string{}, Model: id, Adapter: id, ResourceType: "Application", Resources: []string{}, Actions: []string{}, Effect: "Allow", IsEnabled: true}
	for _, item := range []struct {
		kind     string
		desired  any
		critical func(any) any
	}{
		{kind: "model", desired: model, critical: func(value any) any { v := value.(Model); return []any{v.Owner, v.Name, v.ModelText} }},
		{kind: "adapter", desired: adapter, critical: func(value any) any {
			v := value.(Adapter)
			return []any{v.Owner, v.Name, v.Table, v.UseSameDB, v.Type, v.DatabaseType}
		}},
		{kind: "enforcer", desired: enforcer, critical: func(value any) any { v := value.(Enforcer); return []any{v.Owner, v.Name, v.Model, v.Adapter} }},
		{kind: "permission", desired: permission, critical: func(value any) any {
			v := value.(Permission)
			return []any{v.Owner, v.Name, v.Model, v.Adapter, v.ResourceType, v.IsEnabled}
		}},
	} {
		existing, found, err := c.getManagedObject(ctx, item.kind, id, item.desired)
		if err != nil {
			return err
		}
		if !found {
			if err := c.do(ctx, http.MethodPost, "/api/add-"+item.kind, nil, item.desired, nil); err != nil {
				return err
			}
			continue
		}
		if !reflect.DeepEqual(item.critical(existing), item.critical(item.desired)) {
			return adapterError("casdoor_boundary_conflict", 0, fmt.Errorf("%s %s is not ECP-compatible", item.kind, id))
		}
	}
	return nil
}

func (c *Client) getManagedObject(ctx context.Context, kind, id string, prototype any) (any, bool, error) {
	var target any
	switch prototype.(type) {
	case Model:
		target = &struct {
			Data *Model `json:"data"`
		}{}
	case Adapter:
		target = &struct {
			Data *Adapter `json:"data"`
		}{}
	case Enforcer:
		target = &struct {
			Data *Enforcer `json:"data"`
		}{}
	case Permission:
		target = &struct {
			Data *Permission `json:"data"`
		}{}
	default:
		return nil, false, adapterError("casdoor_boundary_invalid", 0, nil)
	}
	if err := c.do(ctx, http.MethodGet, "/api/get-"+kind, url.Values{"id": []string{id}}, nil, target); err != nil {
		return nil, false, err
	}
	switch value := target.(type) {
	case *struct {
		Data *Model `json:"data"`
	}:
		if value.Data == nil {
			return nil, false, nil
		}
		return *value.Data, true, nil
	case *struct {
		Data *Adapter `json:"data"`
	}:
		if value.Data == nil {
			return nil, false, nil
		}
		return *value.Data, true, nil
	case *struct {
		Data *Enforcer `json:"data"`
	}:
		if value.Data == nil {
			return nil, false, nil
		}
		return *value.Data, true, nil
	case *struct {
		Data *Permission `json:"data"`
	}:
		if value.Data == nil {
			return nil, false, nil
		}
		return *value.Data, true, nil
	}
	return nil, false, adapterError("casdoor_response_invalid", 0, nil)
}

func (c *Client) ownedID(id string) bool {
	owner, name, ok := strings.Cut(id, "/")
	return ok && owner == c.organization && name != "" && !strings.Contains(name, "/")
}

func (c *Client) Enforce(ctx context.Context, enforcerID string, request []string) (bool, error) {
	if !c.ownedID(enforcerID) {
		return false, adapterError("casdoor_boundary_invalid", 0, nil)
	}
	var response struct {
		Data []bool `json:"data"`
	}
	err := c.do(ctx, http.MethodPost, "/api/enforce", url.Values{"enforcerId": []string{enforcerID}}, request, &response)
	if err != nil {
		return false, err
	}
	if len(response.Data) != 1 {
		return false, adapterError("casdoor_response_invalid", http.StatusOK, nil)
	}
	return response.Data[0], nil
}

func (c *Client) BatchEnforce(ctx context.Context, enforcerID string, requests [][]string) ([]bool, error) {
	if !c.ownedID(enforcerID) {
		return nil, adapterError("casdoor_boundary_invalid", 0, nil)
	}
	var response struct {
		Data [][]bool `json:"data"`
	}
	err := c.do(ctx, http.MethodPost, "/api/batch-enforce", url.Values{"enforcerId": []string{enforcerID}}, requests, &response)
	if err != nil {
		return nil, err
	}
	if len(response.Data) != 1 {
		return nil, adapterError("casdoor_response_invalid", http.StatusOK, nil)
	}
	return response.Data[0], nil
}

func (c *Client) do(ctx context.Context, method, path string, query url.Values, body any, target any) error {
	credential, err := c.secrets.Get(ctx, c.credential)
	if err != nil || len(credential) == 0 {
		return adapterError("casdoor_credential_unavailable", 0, err)
	}
	endpoint := c.baseURL + path
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}
	var reader io.Reader
	if body != nil {
		payload, marshalErr := json.Marshal(body)
		if marshalErr != nil {
			return adapterError("casdoor_request_invalid", 0, marshalErr)
		}
		reader = bytes.NewReader(payload)
	}
	request, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return adapterError("casdoor_request_invalid", 0, err)
	}
	request.SetBasicAuth(c.clientID, string(credential))
	request.Header.Set("Accept", "application/json")
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := c.httpClient.Do(request)
	if err != nil {
		return adapterError("casdoor_unavailable", 0, err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 4096))
		return adapterError("casdoor_request_failed", response.StatusCode, nil)
	}
	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return adapterError("casdoor_response_invalid", response.StatusCode, err)
	}
	if len(bytes.TrimSpace(payload)) == 0 {
		if target == nil {
			return nil
		}
		return adapterError("casdoor_response_invalid", response.StatusCode, nil)
	}
	var envelope struct {
		Status string `json:"status"`
		Msg    string `json:"msg"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return adapterError("casdoor_response_invalid", response.StatusCode, err)
	}
	if envelope.Status != "" && envelope.Status != "ok" {
		message := strings.TrimSpace(envelope.Msg)
		if len(message) > 512 {
			message = message[:512]
		}
		if message == "" {
			message = fmt.Sprintf("provider status %q", envelope.Status)
		}
		return adapterError("casdoor_request_failed", response.StatusCode, fmt.Errorf("provider status %q: %s", envelope.Status, message))
	}
	if target == nil {
		return nil
	}
	if err := json.Unmarshal(payload, target); err != nil {
		return adapterError("casdoor_response_invalid", response.StatusCode, err)
	}
	return nil
}

func isLoopback(host string) bool {
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

func isAllowedInsecureHost(host string, configured []string) bool {
	if isLoopback(host) {
		return true
	}
	host = strings.ToLower(strings.TrimSpace(host))
	for _, allowed := range configured {
		if host != "" && host == strings.ToLower(strings.TrimSpace(allowed)) {
			return true
		}
	}
	return false
}
