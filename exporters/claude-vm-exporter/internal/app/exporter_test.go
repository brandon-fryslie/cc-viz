package app

import (
	"context"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/config"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/sink/victoriametrics"
	"github.com/brandon-fryslie/cc-viz/exporters/claude-vm-exporter/internal/state"
)

func TestExporter_BackfillAndDirtyFinalizedBucket(t *testing.T) {
	tempDir := t.TempDir()
	projectsDir := filepath.Join(tempDir, "projects")
	projectDir := filepath.Join(projectsDir, "project-a")
	if err := os.MkdirAll(projectDir, 0o755); err != nil {
		t.Fatalf("MkdirAll() error = %v", err)
	}

	filePath := filepath.Join(projectDir, "session-1.jsonl")
	writeConversationFile(t, filePath, `{"sessionId":"session-1","requestId":"req-1","uuid":"msg-1","timestamp":"2026-04-03T10:15:00Z","message":{"role":"assistant","model":"claude-sonnet","usage":{"input_tokens":10,"output_tokens":20,"cache_read_input_tokens":30,"cache_creation_input_tokens":40}}}
`)

	var exports []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, _ := io.ReadAll(r.Body)
		exports = append(exports, string(payload))
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	store, cleanup := openTestStore(t, filepath.Join(tempDir, "state.db"))
	defer cleanup()

	cfg := &config.Config{
		Source: config.SourceConfig{ProjectsDir: projectsDir},
		State:  config.StateConfig{DBPath: filepath.Join(tempDir, "state.db")},
		VictoriaMetrics: config.VictoriaMetricsConfig{
			WriteURL:   server.URL,
			TimeoutDur: 5 * time.Second,
		},
		Sync: config.SyncConfig{
			PollInterval:         "1m",
			FinalizationDelay:    "65m",
			PollIntervalDur:      time.Minute,
			FinalizationDelayDur: 65 * time.Minute,
		},
		Labels: config.LabelsConfig{Static: map[string]string{"instance": "test"}},
	}

	exporter := New(
		cfg,
		store,
		victoriametrics.New(victoriametrics.Config{
			WriteURL:     server.URL,
			Timeout:      5 * time.Second,
			StaticLabels: cfg.Labels.Static,
		}),
		log.New(io.Discard, "", 0),
	)
	exporter.now = func() time.Time {
		return time.Date(2026, 4, 3, 13, 10, 0, 0, time.UTC)
	}

	if err := exporter.RunBackfill(context.Background(), time.Date(2026, 4, 3, 0, 0, 0, 0, time.UTC), time.Date(2026, 4, 4, 0, 0, 0, 0, time.UTC)); err != nil {
		t.Fatalf("RunBackfill() error = %v", err)
	}

	if len(exports) != 1 {
		t.Fatalf("export count = %d, want 1", len(exports))
	}
	if !strings.Contains(exports[0], `claude_code_hourly_total_tokens{model="claude-sonnet",project="project-a",instance="test"} 100 1775210400000`) {
		t.Fatalf("unexpected export payload:\n%s", exports[0])
	}

	writeConversationFile(t, filePath, `{"sessionId":"session-1","requestId":"req-1","uuid":"msg-1","timestamp":"2026-04-03T10:15:00Z","message":{"role":"assistant","model":"claude-sonnet","usage":{"input_tokens":99,"output_tokens":20,"cache_read_input_tokens":30,"cache_creation_input_tokens":40}}}
`)

	exporter.now = func() time.Time {
		return time.Date(2026, 4, 3, 14, 10, 0, 0, time.UTC)
	}

	if err := exporter.SyncOnce(context.Background(), nil, false); err != nil {
		t.Fatalf("SyncOnce() error = %v", err)
	}

	if len(exports) != 1 {
		t.Fatalf("serve mode re-exported dirty finalized bucket unexpectedly, export count = %d", len(exports))
	}

	dirtyBuckets, err := store.ListDirtyBuckets(context.Background())
	if err != nil {
		t.Fatalf("ListDirtyBuckets() error = %v", err)
	}
	if len(dirtyBuckets) != 1 {
		t.Fatalf("len(dirtyBuckets) = %d, want 1", len(dirtyBuckets))
	}
}

func openTestStore(t *testing.T, path string) (*state.Store, func()) {
	t.Helper()

	store, err := state.Open(path)
	if err != nil {
		t.Fatalf("state.Open() error = %v", err)
	}

	return store, func() {
		_ = store.Close()
	}
}

func writeConversationFile(t *testing.T, path, contents string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
}
