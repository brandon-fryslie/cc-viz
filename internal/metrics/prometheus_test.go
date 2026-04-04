package metrics

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/brandon-fryslie/cc-viz/internal/config"
	"github.com/brandon-fryslie/cc-viz/internal/service"
)

func setupTestStorage(t *testing.T) (*service.SQLiteStorageService, func()) {
	t.Helper()

	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "metrics.db")

	storage, err := service.NewSQLiteStorageService(&config.StorageConfig{DBPath: dbPath})
	if err != nil {
		t.Fatalf("NewSQLiteStorageService() error = %v", err)
	}

	cleanup := func() {
		_ = storage.Close()
		_ = os.Remove(dbPath)
	}

	return storage, cleanup
}

func TestMetricsHandlerExportsAppStats(t *testing.T) {
	storage, cleanup := setupTestStorage(t)
	defer cleanup()

	now := time.Date(2026, 4, 3, 12, 0, 0, 0, time.UTC)
	db := storage.DB()

	_, err := db.Exec(`
		INSERT INTO conversations (id, project_path, project_name, start_time, end_time, message_count, file_path, file_mtime, indexed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "conv-1", "/tmp/project", "project", now.Add(-2*time.Hour).Format(time.RFC3339), now.Add(-time.Hour).Format(time.RFC3339), 2, "/tmp/project/conv-1.jsonl", now.Format(time.RFC3339), now.Format(time.RFC3339))
	if err != nil {
		t.Fatalf("insert conversation: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO conversation_messages (
			uuid, conversation_id, type, role, timestamp, session_id, request_id, model,
			input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, content_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "msg-1", "conv-1", "message", "assistant", now.Add(-30*time.Minute).Format(time.RFC3339), "session-1", "req-1", "claude-3-7-sonnet", 10, 20, 3, 2, `{"text":"hello"}`)
	if err != nil {
		t.Fatalf("insert conversation message: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO sessions (id, project_path, started_at, ended_at, conversation_count, message_count, agent_count, todo_count, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "session-1", "/tmp/project", now.Add(-2*time.Hour).Format(time.RFC3339), now.Add(-time.Hour).Format(time.RFC3339), 1, 2, 1, 1, now.Add(-2*time.Hour).Format(time.RFC3339))
	if err != nil {
		t.Fatalf("insert session: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO claude_todos (session_uuid, agent_uuid, file_path, content, status, active_form, item_index, modified_at, indexed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "session-1", "agent-1", "/tmp/project/todos.json", "Ship metrics", "in_progress", "Ship metrics", 0, now.Format(time.RFC3339), now.Format(time.RFC3339))
	if err != nil {
		t.Fatalf("insert todo: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO claude_todo_sessions (
			session_uuid, agent_uuid, file_path, file_size, todo_count, pending_count,
			in_progress_count, completed_count, modified_at, indexed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "session-1", "agent-1", "/tmp/project/todos.json", 128, 1, 0, 1, 0, now.Format(time.RFC3339), now.Format(time.RFC3339))
	if err != nil {
		t.Fatalf("insert todo session: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO claude_plans (file_name, display_name, content, preview, file_size, modified_at, indexed_at, session_uuid)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, "plan.md", "Plan", "# Plan", "Plan", 64, now.Format(time.RFC3339), now.Format(time.RFC3339), "session-1")
	if err != nil {
		t.Fatalf("insert plan: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO extensions (id, type, name, enabled, source, file_path, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)
	`,
		"plugin-enabled", "plugin", "Enabled Plugin", true, "user", "/tmp/plugin-enabled", now.Format(time.RFC3339), now.Format(time.RFC3339),
		"plugin-disabled", "plugin", "Disabled Plugin", false, "user", "/tmp/plugin-disabled", now.Format(time.RFC3339), now.Format(time.RFC3339),
	)
	if err != nil {
		t.Fatalf("insert extensions: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO subagent_graph (
			session_id, parent_agent_id, agent_id, first_message_uuid, last_message_uuid,
			message_count, spawn_time, end_time, status, is_sidechain, file_path, file_mtime, indexed_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, "session-1", nil, "agent-1", "msg-1", "msg-1", 1, now.Add(-40*time.Minute).Format(time.RFC3339), now.Add(-20*time.Minute).Format(time.RFC3339), "completed", false, "/tmp/project/subagents/agent-1.jsonl", now.Format(time.RFC3339), now.Format(time.RFC3339))
	if err != nil {
		t.Fatalf("insert subagent graph row: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO requests (id, timestamp, method, endpoint, headers, body, content_type)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, "legacy-req-1", now.Format(time.RFC3339), "POST", "/v1/messages", "{}", "{}", "application/json")
	if err != nil {
		t.Fatalf("insert request: %v", err)
	}

	registry := prometheusTestRegistry(storage, now)
	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	recorder := httptest.NewRecorder()
	Handler(registry).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("metrics status = %d, want %d", recorder.Code, http.StatusOK)
	}

	body := recorder.Body.String()
	assertContains(t, body, `ccviz_app_database_up 1`)
	assertContains(t, body, `ccviz_app_scrape_success{subsystem="sessions"} 1`)
	assertContains(t, body, `ccviz_app_sessions{kind="total"} 1`)
	assertContains(t, body, `ccviz_app_session_messages_total 2`)
	assertContains(t, body, `ccviz_app_extensions_total 2`)
	assertContains(t, body, `ccviz_app_enabled_plugins_total 1`)
	assertContains(t, body, `ccviz_app_disabled_plugins_total 1`)
	assertContains(t, body, `ccviz_app_subagents{kind="agents"} 1`)
	assertContains(t, body, `ccviz_app_window_total{kind="tokens",window="7d"} 35`)
	assertContains(t, body, `ccviz_app_window_total{kind="requests",window="7d"} 1`)
	assertContains(t, body, `ccviz_app_model_window_total{kind="tokens",model="claude-3-7-sonnet",window="30d"} 35`)
	assertContains(t, body, `ccviz_app_dataset_total{dataset="conversations"} 1`)
	assertContains(t, body, `ccviz_app_dataset_total{dataset="conversation_messages"} 1`)
	assertContains(t, body, `ccviz_app_dataset_total{dataset="requests"} 1`)
	assertContains(t, body, `ccviz_app_dataset_total{dataset="todos"} 1`)
	assertContains(t, body, `ccviz_app_dataset_total{dataset="todo_sessions"} 1`)
	assertContains(t, body, `ccviz_app_dataset_total{dataset="plans"} 1`)
	assertContains(t, body, `ccviz_app_todos_by_status{status="in_progress"} 1`)
	assertContains(t, body, fmt.Sprintf(`ccviz_app_dataset_last_update_timestamp_seconds{dataset="conversations"} %g`, float64(now.Unix())))
}

func TestHTTPMiddlewareTracksRouteTemplates(t *testing.T) {
	storage, cleanup := setupTestStorage(t)
	defer cleanup()

	registry, httpMetrics := NewRegistry(storage, storage.DB())

	router := mux.NewRouter()
	router.Use(httpMetrics.Middleware)
	router.HandleFunc("/widgets/{id}", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
		_, _ = io.WriteString(w, "ok")
	}).Methods(http.MethodGet)

	server := httptest.NewServer(router)
	defer server.Close()

	response, err := http.Get(server.URL + "/widgets/42")
	if err != nil {
		t.Fatalf("GET /widgets/42 error = %v", err)
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want %d", response.StatusCode, http.StatusAccepted)
	}

	metricsRequest := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	metricsRecorder := httptest.NewRecorder()
	Handler(registry).ServeHTTP(metricsRecorder, metricsRequest)

	body := metricsRecorder.Body.String()
	assertContains(t, body, `ccviz_http_requests_total{method="GET",route="/widgets/{id}",status="202"} 1`)
	assertContains(t, body, `ccviz_http_request_duration_seconds_bucket{method="GET",route="/widgets/{id}",status="202",le="+Inf"} 1`)
}

func prometheusTestRegistry(storage *service.SQLiteStorageService, now time.Time) *prometheus.Registry {
	registry := prometheus.NewRegistry()
	registry.MustRegister(newAppCollector(storage, storage.DB(), func() time.Time { return now }))
	return registry
}

func assertContains(t *testing.T, body string, needle string) {
	t.Helper()
	if !strings.Contains(body, needle) {
		t.Fatalf("expected metrics output to contain %q\nbody:\n%s", needle, body)
	}
}
