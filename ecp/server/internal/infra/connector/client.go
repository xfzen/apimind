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
)

type OutboundCredential struct{ ClientID, Secret, Audience string }
type Client struct {
	baseURL    *url.URL
	credential OutboundCredential
	httpClient *http.Client
}

func NewClient(baseURL string, credential OutboundCredential, httpClient *http.Client) (*Client, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("parse connector URL: %w", err)
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && (parsed.Hostname() == "127.0.0.1" || parsed.Hostname() == "localhost")) {
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

type ResourceSearchRequest struct {
	Delegation          domain.SignedDelegation `json:"delegation"`
	ResourceType, Query string
	Limit               int
}
type ResourceResult struct {
	Type, ID, DisplayName, ParentID string
	Version                         uint64
}
type ResourceSearchResponse struct {
	Resources []ResourceResult `json:"resources"`
	Reason    string           `json:"reason"`
}

func (c *Client) SearchResources(ctx context.Context, request ResourceSearchRequest) ([]ResourceResult, error) {
	var response ResourceSearchResponse
	if err := c.call(ctx, http.MethodPost, "api/v1/ecp/resources/search", request, &response); err != nil {
		return nil, err
	}
	if response.Reason == "resource_not_visible" {
		return nil, &StableDenial{Reason: response.Reason}
	}
	return response.Resources, nil
}

func (c *Client) ResolveResource(ctx context.Context, delegation domain.SignedDelegation, resourceType, id string) (ResourceResult, error) {
	var response struct {
		Resource ResourceResult `json:"resource"`
		Reason   string         `json:"reason"`
	}
	if err := c.call(ctx, http.MethodPost, "api/v1/ecp/resources/resolve", map[string]any{"delegation": delegation, "resource_type": resourceType, "resource_id": id}, &response); err != nil {
		return ResourceResult{}, err
	}
	if response.Reason == "resource_not_visible" || response.Resource.ID == "" {
		return ResourceResult{}, &StableDenial{Reason: "resource_not_visible"}
	}
	return response.Resource, nil
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
