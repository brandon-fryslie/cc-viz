package victoriametrics

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/rollup"
)

type Config struct {
	WriteURL          string
	BearerToken       string
	BasicAuthUser     string
	BasicAuthPassword string
	Timeout           time.Duration
	StaticLabels      map[string]string
}

type Client struct {
	httpClient   *http.Client
	writeURL     string
	bearerToken  string
	basicUser    string
	basicPass    string
	staticLabels map[string]string
}

func New(config Config) *Client {
	staticLabels := make(map[string]string, len(config.StaticLabels))
	for key, value := range config.StaticLabels {
		staticLabels[key] = value
	}

	return &Client{
		httpClient:   &http.Client{Timeout: config.Timeout},
		writeURL:     config.WriteURL,
		bearerToken:  config.BearerToken,
		basicUser:    config.BasicAuthUser,
		basicPass:    config.BasicAuthPassword,
		staticLabels: staticLabels,
	}
}

func (c *Client) Export(ctx context.Context, buckets []rollup.HourlyBucket) error {
	if len(buckets) == 0 {
		return nil
	}

	payload := RenderPrometheusPayload(buckets, c.staticLabels)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.writeURL, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "text/plain; version=0.0.4")
	if c.bearerToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.bearerToken)
	}
	if c.basicUser != "" || c.basicPass != "" {
		req.SetBasicAuth(c.basicUser, c.basicPass)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return fmt.Errorf("victoriametrics export failed: status=%d body=%s", resp.StatusCode, strings.TrimSpace(string(body)))
}

func RenderPrometheusPayload(buckets []rollup.HourlyBucket, staticLabels map[string]string) []byte {
	metrics := []struct {
		name  string
		value func(rollup.HourlyBucket) int64
	}{
		{name: "claude_code_hourly_requests", value: func(bucket rollup.HourlyBucket) int64 { return bucket.Requests }},
		{name: "claude_code_hourly_input_tokens", value: func(bucket rollup.HourlyBucket) int64 { return bucket.InputTokens }},
		{name: "claude_code_hourly_output_tokens", value: func(bucket rollup.HourlyBucket) int64 { return bucket.OutputTokens }},
		{name: "claude_code_hourly_cache_read_tokens", value: func(bucket rollup.HourlyBucket) int64 { return bucket.CacheReadTokens }},
		{name: "claude_code_hourly_cache_creation_tokens", value: func(bucket rollup.HourlyBucket) int64 { return bucket.CacheCreationTokens }},
		{name: "claude_code_hourly_total_tokens", value: func(bucket rollup.HourlyBucket) int64 { return bucket.TotalTokens }},
	}

	labels := make([]string, 0, len(staticLabels)+2)
	for key := range staticLabels {
		labels = append(labels, key)
	}
	sort.Strings(labels)

	var builder strings.Builder
	for _, bucket := range buckets {
		for _, metric := range metrics {
			builder.WriteString(metric.name)
			builder.WriteString("{")
			builder.WriteString(`model="`)
			builder.WriteString(escapeLabelValue(bucket.Model))
			builder.WriteString(`",project="`)
			builder.WriteString(escapeLabelValue(bucket.Project))
			builder.WriteString(`"`)
			for _, label := range labels {
				builder.WriteString(",")
				builder.WriteString(label)
				builder.WriteString(`="`)
				builder.WriteString(escapeLabelValue(staticLabels[label]))
				builder.WriteString(`"`)
			}
			builder.WriteString("} ")
			builder.WriteString(fmt.Sprintf("%d %d\n", metric.value(bucket), bucket.HourStartUTC.UTC().UnixMilli()))
		}
	}

	return []byte(builder.String())
}

func escapeLabelValue(value string) string {
	replacer := strings.NewReplacer(`\`, `\\`, "\n", `\n`, `"`, `\"`)
	return replacer.Replace(value)
}
