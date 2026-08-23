package casdoor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

func NewClient(cfg Config, secrets SecretProvider, httpClient *http.Client) (*Client, error) {
	parsed, err := url.Parse(cfg.BaseURL)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "https" && !(cfg.LocalMode && parsed.Scheme == "http" && isLoopback(parsed.Hostname()))) {
		return nil, adapterError("casdoor_endpoint_invalid", 0, err)
	}
	if cfg.EnterpriseID == "" || cfg.Organization == "" || cfg.CredentialReference == "" || secrets == nil {
		return nil, adapterError("casdoor_config_invalid", 0, nil)
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &Client{
		baseURL: strings.TrimRight(parsed.String(), "/"), enterpriseID: cfg.EnterpriseID,
		organization: cfg.Organization, credential: cfg.CredentialReference, secrets: secrets, httpClient: httpClient,
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

func (c *Client) ReadPolicies(ctx context.Context) ([]Policy, error) {
	var response struct {
		Data []Policy `json:"data"`
	}
	err := c.do(ctx, http.MethodGet, "/api/get-policies", url.Values{"owner": []string{c.organization}}, nil, &response)
	return response.Data, err
}

func (c *Client) WritePolicies(ctx context.Context, policies []Policy) error {
	return c.do(ctx, http.MethodPost, "/api/add-policies", nil, policies, nil)
}

func (c *Client) DeletePolicies(ctx context.Context, policies []Policy) error {
	return c.do(ctx, http.MethodPost, "/api/remove-policies", nil, policies, nil)
}

func (c *Client) Enforce(ctx context.Context, permissionID string, request []string) (bool, error) {
	var response struct {
		Data []bool `json:"data"`
	}
	err := c.do(ctx, http.MethodPost, "/api/enforce", url.Values{"permissionId": []string{permissionID}}, request, &response)
	if err != nil {
		return false, err
	}
	if len(response.Data) != 1 {
		return false, adapterError("casdoor_response_invalid", http.StatusOK, nil)
	}
	return response.Data[0], nil
}

func (c *Client) BatchEnforce(ctx context.Context, permissionID string, requests [][]string) ([]bool, error) {
	var response struct {
		Data [][]bool `json:"data"`
	}
	err := c.do(ctx, http.MethodPost, "/api/batch-enforce", url.Values{"permissionId": []string{permissionID}}, requests, &response)
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
	request.Header.Set("Authorization", "Bearer "+string(credential))
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
	if target == nil {
		_, _ = io.Copy(io.Discard, response.Body)
		return nil
	}
	payload, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return adapterError("casdoor_response_invalid", response.StatusCode, err)
	}
	var envelope struct {
		Status string `json:"status"`
		Msg    string `json:"msg"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return adapterError("casdoor_response_invalid", response.StatusCode, err)
	}
	if envelope.Status != "" && envelope.Status != "ok" {
		return adapterError("casdoor_request_failed", response.StatusCode, fmt.Errorf("provider status %q", envelope.Status))
	}
	if err := json.Unmarshal(payload, target); err != nil {
		return adapterError("casdoor_response_invalid", response.StatusCode, err)
	}
	return nil
}

func isLoopback(host string) bool {
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}
