package service

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

// TestFTS5ModuleAvailable verifies that SQLite was compiled with FTS5 support.
// This test will FAIL if you build without CGO_ENABLED=1 -tags "fts5".
//
// To fix: CGO_ENABLED=1 go test -tags "fts5" ./...
func TestFTS5ModuleAvailable(t *testing.T) {
	// Create a temporary database
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "fts5_test.db")

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()
	defer os.Remove(dbPath)

	// Try to create an FTS5 virtual table
	_, err = db.Exec(`CREATE VIRTUAL TABLE test_fts USING fts5(content)`)
	if err != nil {
		t.Fatalf(`FTS5 module not available!

ERROR: %v

This means SQLite was not compiled with FTS5 support.
Conversation indexing and full-text search will not work.

TO FIX, build with CGO enabled:
  CGO_ENABLED=1 go build -tags "fts5" ./...
  CGO_ENABLED=1 go test -tags "fts5" ./...

Or use the justfile which handles this automatically:
  just build
  just test
`, err)
	}

	// Verify we can insert and query
	_, err = db.Exec(`INSERT INTO test_fts(content) VALUES ('hello world')`)
	if err != nil {
		t.Fatalf("Failed to insert into FTS5 table: %v", err)
	}

	var count int
	err = db.QueryRow(`SELECT COUNT(*) FROM test_fts WHERE test_fts MATCH 'hello'`).Scan(&count)
	if err != nil {
		t.Fatalf("Failed to query FTS5 table: %v", err)
	}

	if count != 1 {
		t.Errorf("Expected 1 match, got %d", count)
	}

	t.Log("✅ FTS5 module is available and working")
}
