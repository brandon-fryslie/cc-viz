package searchsql

import (
	"database/sql"
	"fmt"
)

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) EnsureFTS5() error {
	var options int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'").Scan(&options); err != nil {
		return fmt.Errorf("check FTS5 compile options: %w", err)
	}
	if options == 0 {
		return fmt.Errorf("FTS5 support is required but unavailable")
	}

	var tableCount int
	if err := s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='conversations_fts'").Scan(&tableCount); err != nil {
		return fmt.Errorf("check conversations_fts table: %w", err)
	}
	if tableCount == 0 {
		return fmt.Errorf("conversations_fts table missing")
	}

	return nil
}

func (s *Store) NormalizeDataTypes(dataTypes []string) []string {
	if len(dataTypes) == 0 {
		// [LAW:one-source-of-truth] Runtime unified search defaults are centralized here.
		return []string{"conversations", "extensions", "todos", "plans"}
	}

	normalized := make([]string, 0, len(dataTypes))
	for _, dataType := range dataTypes {
		switch dataType {
		case "conversations", "extensions", "todos", "plans":
			normalized = append(normalized, dataType)
		}
	}
	if len(normalized) == 0 {
		return []string{"conversations", "extensions", "todos", "plans"}
	}
	return normalized
}
