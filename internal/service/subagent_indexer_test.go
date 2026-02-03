package service

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/brandon-fryslie/cc-viz/internal/config"
)

func TestSubagentIndexer_FindParentAgentID(t *testing.T) {
	// Test that findParentAgentID returns nil for all subagents
	// (since we have a flat hierarchy where all subagents are children of the root session)
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

	// Test with various message patterns
	testCases := []struct {
		name     string
		messages []SubagentMessage
		wantNil  bool
	}{
		{
			name: "messages with parentUuid",
			messages: []SubagentMessage{
				{UUID: "msg-1", ParentUUID: nil},
				{UUID: "msg-2", ParentUUID: strPtr("parent-uuid-123")},
			},
			wantNil: true, // Should return nil since we use flat hierarchy
		},
		{
			name: "messages without parentUuid",
			messages: []SubagentMessage{
				{UUID: "msg-1", ParentUUID: nil},
				{UUID: "msg-2", ParentUUID: nil},
			},
			wantNil: true,
		},
		{
			name:     "empty messages",
			messages: []SubagentMessage{},
			wantNil:  true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			parentID, err := indexer.findParentAgentID(tc.messages)
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if tc.wantNil && parentID != nil {
				t.Errorf("Expected nil parent_agent_id for flat hierarchy, got %v", *parentID)
			}
			if !tc.wantNil && parentID == nil {
				t.Error("Expected non-nil parent_agent_id")
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
