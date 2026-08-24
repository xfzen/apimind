package connector

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/xfzen/ecp/server/internal/domain"
	"github.com/xfzen/ecp/server/internal/service/productresource"
)

type OutboundCredential struct{ ClientID, Secret, Audience string }
type Client struct {
	baseURL    *url.URL
	credential OutboundCredential
	httpClient *http.Client
}

func NewClient(baseURL string, credential OutboundCredential, httpClient *http.Client) (*Client, error) {
	return NewClientWithOptions(baseURL, credential, httpClient, false, nil)
}

func NewClientWithOptions(baseURL string, credential OutboundCredential, httpClient *http.Client, localMode bool, allowedInsecureHosts []string) (*Client, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("parse connector URL: %w", err)
	}
	allowedHTTP := parsed.Hostname() == "127.0.0.1" || parsed.Hostname() == "localhost"
	if localMode && !allowedHTTP {
		for _, host := range allowedInsecureHosts {
			if strings.EqualFold(strings.TrimSpace(host), parsed.Hostname()) {
				allowedHTTP = true
				break
			}
		}
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && allowedHTTP) {
		return nil, fmt.Errorf("connector URL must use HTTPS or loopback HTTP")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || credential.ClientID == "" || credential.Secret == "" || credential.Audience == "" {
		return nil, fmt.Errorf("invalid outbound connector configuration")
	}
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/"
	return &Client{baseURL: parsed, credential: credential, httpClient: httpClient}, nil
}

type wireResource struct {
	Type        string `json:"type"`
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	ParentID    string `json:"parent_id"`
	Version     uint64 `json:"version"`
}
type ResourceSearchResponse struct {
	Resources []wireResource `json:"resources"`
	Reason    string         `json:"reason"`
}

func (c *Client) SearchResources(ctx context.Context, delegation domain.SignedDelegation, input productresource.SearchInput) ([]domain.ResourceReference, error) {
	var response ResourceSearchResponse
	request := map[string]any{"delegation": delegation, "resource_type": input.ResourceType, "query": input.Query, "limit": input.Limit}
	if err := c.call(ctx, http.MethodPost, "api/enterprise/connector/v1/resources/search", request, &response); err != nil {
		return nil, err
	}
	if response.Reason == "resource_not_visible" {
		return nil, &StableDenial{Reason: response.Reason}
	}
	return resourceReferences(response.Resources), nil
}

func (c *Client) ResolveResource(ctx context.Context, delegation domain.SignedDelegation, input productresource.ResourceInput) (domain.ResourceReference, error) {
	var response struct {
		Resource wireResource `json:"resource"`
		Reason   string       `json:"reason"`
	}
	if err := c.call(ctx, http.MethodPost, "api/enterprise/connector/v1/resources/resolve", map[string]any{"delegation": delegation, "resource_type": input.ResourceType, "resource_id": input.ResourceID}, &response); err != nil {
		return domain.ResourceReference{}, err
	}
	if response.Reason == "resource_not_visible" || response.Resource.ID == "" {
		return domain.ResourceReference{}, &StableDenial{Reason: "resource_not_visible"}
	}
	return resourceReference(response.Resource), nil
}

func (c *Client) GetResourceAncestry(ctx context.Context, delegation domain.SignedDelegation, input productresource.ResourceInput) ([]domain.ResourceReference, error) {
	var response ResourceSearchResponse
	if err := c.call(ctx, http.MethodPost, "api/enterprise/connector/v1/resources/ancestry", map[string]any{"delegation": delegation, "resource_type": input.ResourceType, "resource_id": input.ResourceID}, &response); err != nil {
		return nil, err
	}
	if response.Reason == "resource_not_visible" {
		return nil, &StableDenial{Reason: response.Reason}
	}
	return resourceReferences(response.Resources), nil
}

func (c *Client) ApplyCompatibilityProjection(ctx context.Context, delegation domain.SignedDelegation, input productresource.ProjectionInput) error {
	var response struct {
		Applied bool   `json:"applied"`
		Reason  string `json:"reason"`
	}
	request := map[string]any{
		"delegation": delegation, "operation_id": input.OperationID, "resource_type": input.ResourceType,
		"resource_id": input.ResourceID, "payload_hash": input.PayloadHash, "payload": input.Payload,
	}
	if err := c.call(ctx, http.MethodPost, "api/enterprise/connector/v1/projections/members", request, &response); err != nil {
		return err
	}
	if response.Reason != "" {
		return &StableDenial{Reason: "projection_rejected"}
	}
	return nil
}

func (c *Client) FlushProductAudit(ctx context.Context, delegation domain.SignedDelegation) error {
	var response struct {
		Flushed bool `json:"flushed"`
	}
	if err := c.call(ctx, http.MethodPost, "api/enterprise/connector/v1/audit/flush", map[string]any{"delegation": delegation}, &response); err != nil {
		return err
	}
	if !response.Flushed {
		return fmt.Errorf("product audit flush not acknowledged")
	}
	return nil
}

func resourceReferences(values []wireResource) []domain.ResourceReference {
	result := make([]domain.ResourceReference, len(values))
	for index := range values {
		result[index] = resourceReference(values[index])
	}
	return result
}

func resourceReference(value wireResource) domain.ResourceReference {
	return domain.ResourceReference{ResourceType: value.Type, ExternalID: value.ID, ParentExternalID: value.ParentID, DisplayName: value.DisplayName, ResourceVersion: value.Version, Visible: true}
}

func (c *Client) call(ctx context.Context, method, path string, input, output any) error {
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	endpoint := c.baseURL.ResolveReference(&url.URL{Path: path})
	req, err := http.NewRequestWithContext(ctx, method, endpoint.String(), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-ECP-Outbound-Client-ID", c.credential.ClientID)
	req.Header.Set("X-ECP-Audience", c.credential.Audience)
	req.Header.Set("Authorization", "Bearer "+c.credential.Secret)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("connector request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusForbidden {
		io.Copy(io.Discard, resp.Body)
		return &StableDenial{Reason: "resource_not_visible"}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.Copy(io.Discard, resp.Body)
		return fmt.Errorf("connector status %d", resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(output); err != nil {
		return fmt.Errorf("decode connector response: %w", err)
	}
	return nil
}

type StableDenial struct{ Reason string }

func (e *StableDenial) Error() string { return e.Reason }
