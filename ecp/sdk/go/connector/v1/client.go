package connectorv1

import (
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
