package victoriametrics

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/rollup"
)

func TestRenderPrometheusPayload(t *testing.T) {
	payload := string(RenderPrometheusPayload([]rollup.HourlyBucket{
		{
			HourStartUTC:        time.Date(2026, 4, 3, 10, 0, 0, 0, time.UTC),
			Project:             "proj",
			Model:               "sonnet",
			Requests:            2,
			InputTokens:         10,
			OutputTokens:        20,
			CacheReadTokens:     30,
			CacheCreationTokens: 40,
			TotalTokens:         100,
		},
	}, map[string]string{"instance": "desktop"}))

	if !strings.Contains(payload, `claude_code_hourly_total_tokens{model="sonnet",project="proj",instance="desktop"} 100 1775210400000`) {
		t.Fatalf("unexpected payload:\n%s", payload)
	}
}

func TestClient_UsesAuthAndWriteURL(t *testing.T) {
	var authHeader string
	var body string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		payload, _ := io.ReadAll(r.Body)
		body = string(payload)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := New(Config{
		WriteURL:    server.URL,
		BearerToken: "secret",
		Timeout:     5 * time.Second,
	})
	err := client.Export(context.Background(), []rollup.HourlyBucket{{
		HourStartUTC: time.Date(2026, 4, 3, 10, 0, 0, 0, time.UTC),
		Project:      "proj",
		Model:        "sonnet",
		Requests:     1,
	}})
	if err != nil {
		t.Fatalf("Export() error = %v", err)
	}

	if authHeader != "Bearer secret" {
		t.Fatalf("Authorization = %q, want Bearer secret", authHeader)
	}
	if !strings.Contains(body, "claude_code_hourly_requests") {
		t.Fatalf("body missing metric name: %s", body)
	}
}
