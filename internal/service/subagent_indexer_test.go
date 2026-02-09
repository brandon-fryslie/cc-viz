package service

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/brandon-fryslie/cc-viz/internal/config"
)

func TestSubagentIndexer_FindParentAgentID(t *testing.T) {
	tmpDB := filepath.Join(t.TempDir(), "test.db")
	cfg := &config.Config{
		Storage: config.StorageConfig{
			DBPath: tmpDB,
		},
	}
	storage, err := NewSQLiteStorageService(&cfg.Storage)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()

	sqliteStorage := storage.(*SQLiteStorageService)
	indexer, err := NewSubagentIndexer(sqliteStorage)
	if err != nil {
		t.Fatalf("Failed to create indexer: %v", err)
	}

	// Set up a fake session directory structure:
	//   {tmpDir}/session-123.jsonl          <- parent
	//   {tmpDir}/session-123/subagents/agent-abc.jsonl
	tmpDir := t.TempDir()
	sessionDir := filepath.Join(tmpDir, "session-123")
	subagentsDir := filepath.Join(sessionDir, "subagents")
	if err := os.MkdirAll(subagentsDir, 0o755); err != nil {
		t.Fatalf("Failed to create subagents dir: %v", err)
	}

	agentFile := filepath.Join(subagentsDir, "agent-abc.jsonl")
	if err := os.WriteFile(agentFile, []byte(`{"agentId":"abc"}`+"\n"), 0o644); err != nil {
		t.Fatalf("Failed to write agent file: %v", err)
	}

	testCases := []struct {
		name        string
		parentData  string // Content of the parent JSONL
		siblingData string // Content of a sibling subagent file (optional)
		agentID     string
		wantNil     bool
		wantParent  string // Expected parent agent ID (if not nil)
	}{
		{
			name: "root-spawned agent",
			parentData: `{"agentId":"","type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"Done.\nagentId: abc (internal ID)"}]}]}}` + "\n",
			agentID:    "abc",
			wantNil:    true, // Root spawned → nil
		},
		{
			name: "nested agent spawned by parent-xyz",
			parentData: `{"agentId":"parent-xyz","type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"text","text":"Result\nagentId: abc (internal)"}]}]}}` + "\n",
			agentID:    "abc",
			wantNil:    false,
			wantParent: "parent-xyz",
		},
		{
			name:       "agent not found in parent JSONL",
			parentData: `{"agentId":"","type":"user","message":{"role":"user","content":"hello"}}` + "\n",
			agentID:    "abc",
			wantNil:    true, // Not found → nil
		},
		{
			name:       "compact agent returns nil",
			parentData: `{"agentId":"","type":"user","message":{"role":"user","content":"hello"}}` + "\n",
			agentID:    "compact-123",
			wantNil:    true, // Compact agents have no parent
		},
		{
			name:        "nested agent spawned by sibling",
			parentData:  `{"agentId":"","type":"user","message":{"role":"user","content":"hello"}}` + "\n",
			siblingData: `{"agentId":"sibling-agent","type":"user","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t2","content":[{"type":"text","text":"Spawned\nagentId: nested-abc (internal)"}]}]}}` + "\n",
			agentID:     "nested-abc",
			wantNil:     false,
			wantParent:  "sibling-agent",
		},
	}

	parentJSONL := filepath.Join(tmpDir, "session-123.jsonl")
	siblingFile := filepath.Join(subagentsDir, "agent-sibling.jsonl")

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if err := os.WriteFile(parentJSONL, []byte(tc.parentData), 0o644); err != nil {
				t.Fatalf("Failed to write parent JSONL: %v", err)
			}

			// Write sibling file if test case provides it
			if tc.siblingData != "" {
				if err := os.WriteFile(siblingFile, []byte(tc.siblingData), 0o644); err != nil {
					t.Fatalf("Failed to write sibling file: %v", err)
				}
				defer os.Remove(siblingFile)
			}

			parentID, err := indexer.findParentAgentID(tc.agentID, agentFile)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if tc.wantNil && parentID != nil {
				t.Errorf("Expected nil parent, got %q", *parentID)
			}
			if !tc.wantNil {
				if parentID == nil {
					t.Fatalf("Expected parent %q, got nil", tc.wantParent)
				}
				if *parentID != tc.wantParent {
					t.Errorf("Expected parent %q, got %q", tc.wantParent, *parentID)
				}
			}
		})
	}
}

func TestSubagentIndexer_IndexFile(t *testing.T) {
	// Skip if ~/.claude/projects doesn't exist
	homeDir, _ := os.UserHomeDir()
	projectsPath := filepath.Join(homeDir, ".claude", "projects")
	if _, err := os.Stat(projectsPath); os.IsNotExist(err) {
		t.Skip("~/.claude/projects not found")
	}

	// Create temp database
	tmpDB := filepath.Join(t.TempDir(), "test.db")
	cfg := &config.Config{
		Storage: config.StorageConfig{
			DBPath: tmpDB,
		},
	}
	storage, err := NewSQLiteStorageService(&cfg.Storage)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()

	sqliteStorage := storage.(*SQLiteStorageService)
	indexer, err := NewSubagentIndexer(sqliteStorage)
	if err != nil {
		t.Fatalf("Failed to create indexer: %v", err)
	}

	// Find a real subagent file to test with
	var testFile string
	err = filepath.Walk(projectsPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if filepath.Base(path) == "agent-a7e8568.jsonl" || (filepath.Ext(path) == ".jsonl" && filepath.Base(path)[:6] == "agent-") {
			testFile = path
			return filepath.SkipAll
		}
		return nil
	})

	if testFile == "" {
		t.Skip("No subagent files found to test with")
	}

	// Test indexing the file
	err = indexer.indexFile(testFile)
	if err != nil {
		t.Fatalf("indexFile failed: %v", err)
	}

	// Verify the record was created
	var count int
	err = sqliteStorage.db.QueryRow("SELECT COUNT(*) FROM subagent_graph WHERE file_path = ?", testFile).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query database: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1 record, got %d", count)
	}

	// Verify extracted fields
	var sessionID, agentID string
	var messageCount int
	err = sqliteStorage.db.QueryRow(
		"SELECT session_id, agent_id, message_count FROM subagent_graph WHERE file_path = ?",
		testFile,
	).Scan(&sessionID, &agentID, &messageCount)
	if err != nil {
		t.Fatalf("Failed to query record details: %v", err)
	}

	if sessionID == "" {
		t.Error("Expected non-empty session_id")
	}
	if agentID == "" {
		t.Error("Expected non-empty agent_id")
	}
	if messageCount <= 0 {
		t.Errorf("Expected positive message_count, got %d", messageCount)
	}

	t.Logf("Successfully indexed: session_id=%s, agent_id=%s, message_count=%d", sessionID, agentID, messageCount)
}

func TestSubagentIndexer_NeedsIndexing(t *testing.T) {
	// Create temp database
	tmpDB := filepath.Join(t.TempDir(), "test.db")
	cfg := &config.Config{
		Storage: config.StorageConfig{
			DBPath: tmpDB,
		},
	}
	storage, err := NewSQLiteStorageService(&cfg.Storage)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()

	sqliteStorage := storage.(*SQLiteStorageService)
	indexer, err := NewSubagentIndexer(sqliteStorage)
	if err != nil {
		t.Fatalf("Failed to create indexer: %v", err)
	}

	// Test file that doesn't exist in DB yet
	testPath := "/fake/path/agent-test.jsonl"
	testTime := time.Now()
	needs, err := indexer.needsIndexing(testPath, testTime)
	if err != nil {
		t.Fatalf("needsIndexing failed: %v", err)
	}
	if !needs {
		t.Error("Expected file not in DB to need indexing")
	}

	// Insert a record with a specific mtime
	oldTime := "2024-01-01T00:00:00Z"
	_, err = sqliteStorage.db.Exec(`
		INSERT INTO subagent_graph (session_id, agent_id, file_path, file_mtime, message_count)
		VALUES (?, ?, ?, ?, ?)
	`, "test-session", "test-agent", testPath, oldTime, 1)
	if err != nil {
		t.Fatalf("Failed to insert test record: %v", err)
	}

	// Test with file modified after indexed time
	newTime, _ := time.Parse(time.RFC3339, "2024-06-01T00:00:00Z")
	needs, err = indexer.needsIndexing(testPath, newTime)
	if err != nil {
		t.Fatalf("needsIndexing failed: %v", err)
	}
	if !needs {
		t.Error("Expected modified file to need re-indexing")
	}

	// Test with file not modified
	sameTime, _ := time.Parse(time.RFC3339, oldTime)
	needs, err = indexer.needsIndexing(testPath, sameTime)
	if err != nil {
		t.Fatalf("needsIndexing failed: %v", err)
	}
	if needs {
		t.Error("Expected unmodified file to not need re-indexing")
	}
}

func TestSubagentIndexer_InitialIndex(t *testing.T) {
	// Skip if ~/.claude/projects doesn't exist
	homeDir, _ := os.UserHomeDir()
	projectsPath := filepath.Join(homeDir, ".claude", "projects")
	if _, err := os.Stat(projectsPath); os.IsNotExist(err) {
		t.Skip("~/.claude/projects not found")
	}

	// Create temp database
	tmpDB := filepath.Join(t.TempDir(), "test.db")
	cfg := &config.Config{
		Storage: config.StorageConfig{
			DBPath: tmpDB,
		},
	}
	storage, err := NewSQLiteStorageService(&cfg.Storage)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer storage.Close()

	sqliteStorage := storage.(*SQLiteStorageService)
	indexer, err := NewSubagentIndexer(sqliteStorage)
	if err != nil {
		t.Fatalf("Failed to create indexer: %v", err)
	}

	if err := indexer.initialIndex(); err != nil {
		t.Fatalf("Initial index failed: %v", err)
	}

	// Verify some data was indexed
	var count int
	sqliteStorage.db.QueryRow("SELECT COUNT(*) FROM subagent_graph").Scan(&count)
	if count == 0 {
		t.Log("Warning: No subagent data indexed (this is OK if no subagent files exist)")
	} else {
		t.Logf("Successfully indexed %d subagent records", count)
	}
}

// Helper functions
func strPtr(s string) *string {
	return &s
}
