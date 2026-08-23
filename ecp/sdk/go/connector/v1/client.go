package connectorv1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
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
	payload := map[string]any{"instance_id": input.InstanceID, "version": input.Version, "observed_at": input.ObservedAt.Unix()}
	return c.do(ctx, http.MethodPost, "api/v1/connector/heartbeat", payload, &struct{}{})
}
func (c *Client) ResolveSession(ctx context.Context, input SessionResolutionRequest) (SessionResolution, error) {
	var output struct {
		PrincipalID      string `json:"principal_id"`
		Revoked          bool   `json:"revoked"`
		ExpiresAt        int64  `json:"expires_at"`
		LifecycleVersion uint64 `json:"lifecycle_version"`
	}
	err := c.do(ctx, http.MethodPost, "api/v1/connector/sessions/resolve", input, &output)
	return SessionResolution{PrincipalID: output.PrincipalID, Revoked: output.Revoked, ExpiresAt: time.Unix(output.ExpiresAt, 0).UTC(), LifecycleVersion: output.LifecycleVersion}, err
}
func (c *Client) RevokeProductSession(ctx context.Context, input SessionRevocationRequest) error {
	return c.do(ctx, http.MethodPost, "api/v1/connector/sessions/revoke", input, &struct{}{})
}
func (c *Client) BeginProductLogin(ctx context.Context, input ProductLoginStartRequest) (ProductLoginStart, error) {
	var output struct {
		TransactionID    string `json:"transaction_id"`
		State            string `json:"state"`
		PKCEVerifier     string `json:"pkce_verifier"`
		Nonce            string `json:"nonce"`
		AuthorizationURL string `json:"authorization_url"`
		ExpiresAt        int64  `json:"expires_at"`
	}
	err := c.do(ctx, http.MethodPost, "api/v1/connector/auth/start", input, &output)
	return ProductLoginStart{TransactionID: output.TransactionID, State: output.State, PKCEVerifier: output.PKCEVerifier, Nonce: output.Nonce, AuthorizationURL: output.AuthorizationURL, ExpiresAt: time.Unix(output.ExpiresAt, 0).UTC()}, err
}
func (c *Client) CompleteProductLogin(ctx context.Context, input ProductLoginCompleteRequest) (ProductLoginComplete, error) {
	var output struct {
		ExchangeCode string `json:"exchange_code"`
		ExpiresAt    int64  `json:"expires_at"`
	}
	err := c.do(ctx, http.MethodPost, "api/v1/connector/auth/complete", input, &output)
	return ProductLoginComplete{ExchangeCode: output.ExchangeCode, ExpiresAt: time.Unix(output.ExpiresAt, 0).UTC()}, err
}
func (c *Client) ExchangeProductLogin(ctx context.Context, code string) (ProductLoginExchange, error) {
	var output struct {
		SessionToken string `json:"session_token"`
		CSRFToken    string `json:"csrf_token"`
		ExpiresAt    int64  `json:"expires_at"`
	}
	err := c.do(ctx, http.MethodPost, "api/v1/connector/auth/exchange", map[string]string{"code": code}, &output)
	return ProductLoginExchange{SessionToken: output.SessionToken, CSRFToken: output.CSRFToken, ExpiresAt: time.Unix(output.ExpiresAt, 0).UTC()}, err
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
func (c *Client) AuthenticateServiceCredential(ctx context.Context, input ServiceCredentialAuthorizationRequest) (ServiceCredentialAuthorization, error) {
	var output ServiceCredentialAuthorization
	err := c.do(ctx, http.MethodPost, "api/v1/connector/service-credentials/authenticate", input, &output)
	return output, err
}
func (c *Client) IngestAuditEvents(ctx context.Context, input []AuditEvent) error {
	events := make([]map[string]any, len(input))
	for index := range input {
		events[index] = map[string]any{"operation_id": input[index].OperationID, "action": input[index].Action, "resource_type": input[index].ResourceType, "resource_id": input[index].ResourceID, "outcome": input[index].Outcome, "occurred_at": input[index].OccurredAt.Unix()}
	}
	return c.do(ctx, http.MethodPost, "api/v1/connector/audit/events", map[string]any{"events": events}, &struct{}{})
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
