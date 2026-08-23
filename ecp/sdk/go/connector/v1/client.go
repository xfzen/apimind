package connectorv1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

type Client struct {
	baseURL    *url.URL
	httpClient *http.Client
	credential ConnectorCredential
}

func (c *Client) WithCredential(value ConnectorCredential) *Client {
	clone := *c
	clone.credential = value
	return &clone
}

func NewClient(baseURL string, httpClient *http.Client) (*Client, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("parse base URL: %w", err)
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && (parsed.Hostname() == "127.0.0.1" || parsed.Hostname() == "localhost")) {
		return nil, fmt.Errorf("connector base URL must use HTTPS or loopback HTTP")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, fmt.Errorf("connector base URL cannot contain credentials, query, or fragment")
	}
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/"
	return &Client{baseURL: parsed, httpClient: httpClient}, nil
}

func (c *Client) Health(ctx context.Context) (Health, error) {
	endpoint := c.baseURL.ResolveReference(&url.URL{Path: "api/v1/meta/health"})
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return Health{}, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return Health{}, fmt.Errorf("request health: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var apiErr APIError
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err != nil {
			return Health{}, fmt.Errorf("health status %d", resp.StatusCode)
		}
		apiErr.StatusCode = resp.StatusCode
		return Health{}, &apiErr
	}
	var health Health
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return Health{}, fmt.Errorf("decode health: %w", err)
	}
	return health, nil
}

func (c *Client) RegisterInstance(ctx context.Context, input InstanceRegistration) (InstanceRegistrationResult, error) {
	var output InstanceRegistrationResult
	err := c.do(ctx, http.MethodPost, "api/v1/connectors/register", input, &output)
	return output, err
}
func (c *Client) Heartbeat(ctx context.Context, input HeartbeatRequest) error {
	return c.do(ctx, http.MethodPost, "api/v1/connector/heartbeat", input, &struct{}{})
}
func (c *Client) ResolveSession(ctx context.Context, input SessionResolutionRequest) (SessionResolution, error) {
	var output SessionResolution
	err := c.do(ctx, http.MethodPost, "api/v1/connector/sessions/resolve", input, &output)
	return output, err
}
func (c *Client) Authorize(ctx context.Context, input AuthorizationRequest) (AuthorizationDecision, error) {
	var output AuthorizationDecision
	err := c.do(ctx, http.MethodPost, "api/v1/access/authorize", input, &output)
	return output, err
}
func (c *Client) BatchAuthorize(ctx context.Context, input []AuthorizationRequest) ([]AuthorizationDecision, error) {
	var output struct {
		Decisions []AuthorizationDecision `json:"decisions"`
	}
	err := c.do(ctx, http.MethodPost, "api/v1/access/batch", map[string]any{"requests": input}, &output)
	return output.Decisions, err
}
func (c *Client) IngestAuditEvents(ctx context.Context, input []AuditEvent) error {
	return c.do(ctx, http.MethodPost, "api/v1/connector/audit/events", map[string]any{"events": input}, &struct{}{})
}
func (c *Client) GetPolicyVersion(ctx context.Context, instanceID string) (PolicyVersion, error) {
	var output PolicyVersion
	err := c.do(ctx, http.MethodGet, "api/v1/connector/instances/"+url.PathEscape(instanceID)+"/policy-version", nil, &output)
	return output, err
}
func (c *Client) PollLifecycleChanges(ctx context.Context, cursor LifecycleCursor) (LifecycleChanges, error) {
	var output LifecycleChanges
	err := c.do(ctx, http.MethodPost, "api/v1/connector/lifecycle/poll", cursor, &output)
	return output, err
}
func (c *Client) GetDelegationKeySet(ctx context.Context) (SignedKeySet, error) {
	var output SignedKeySet
	err := c.do(ctx, http.MethodGet, "api/v1/connector/signing-keys/delegation", nil, &output)
	return output, err
}
func (c *Client) AckDelegationKeySet(ctx context.Context, input KeySetAck) error {
	return c.do(ctx, http.MethodPost, "api/v1/connector/signing-keys/delegation/ack", input, &struct{}{})
}

func (c *Client) do(ctx context.Context, method, path string, input, output any) error {
	var body *bytes.Reader
	if input == nil {
		body = bytes.NewReader(nil)
	} else {
		encoded, err := json.Marshal(input)
		if err != nil {
			return err
		}
		body = bytes.NewReader(encoded)
	}
	endpoint := c.baseURL.ResolveReference(&url.URL{Path: path})
	req, err := http.NewRequestWithContext(ctx, method, endpoint.String(), body)
	if err != nil {
		return err
	}
	if input != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.credential.ConnectorID != "" {
		req.Header.Set("X-ECP-Connector-ID", c.credential.ConnectorID)
		req.Header.Set("Authorization", "Bearer "+c.credential.Secret)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connector request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr APIError
		if err := json.NewDecoder(resp.Body).Decode(&apiErr); err != nil {
			return fmt.Errorf("connector status %d", resp.StatusCode)
		}
		apiErr.StatusCode = resp.StatusCode
		return &apiErr
	}
	if resp.StatusCode == http.StatusNoContent {
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(output); err != nil {
		return fmt.Errorf("decode connector response: %w", err)
	}
	return nil
}
