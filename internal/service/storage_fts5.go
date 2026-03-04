//go:build !test
// +build !test

package service

import (
	"database/sql"
	"fmt"
	"log"
)

// createFTS5Table creates the FTS5 virtual table for full-text search (production builds only)
func createFTS5Table(db *sql.DB) error {
	// Check if FTS5 table exists
	var ftsExists int
	err := db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='conversations_fts'").Scan(&ftsExists)
	if err != nil {
		return fmt.Errorf("failed to check if FTS table exists: %w", err)
	}

	if ftsExists == 0 {
		// Create FTS5 virtual table
		ftsSchema := `
		CREATE VIRTUAL TABLE conversations_fts USING fts5(
			conversation_id UNINDEXED,
			message_uuid UNINDEXED,
			message_type,
			content_text,
			tool_names,
			timestamp UNINDEXED,
			tokenize='porter unicode61'
		);
		`

		if _, err := db.Exec(ftsSchema); err != nil {
			return fmt.Errorf("failed to create FTS table: %w", err)
		}

		log.Println("✅ Created conversations_fts FTS5 table")
	}

	// Create requests_fts virtual table
	var requestsFtsExists int
	err = db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='requests_fts'").Scan(&requestsFtsExists)
	if err != nil {
		return fmt.Errorf("failed to check if requests_fts table exists: %w", err)
	}

	if requestsFtsExists == 0 {
		requestsFtsSchema := `
		CREATE VIRTUAL TABLE requests_fts USING fts5(
			request_id UNINDEXED,
			timestamp UNINDEXED,
			method,
			endpoint,
			model,
			provider,
			tool_names,
			response_text,
			request_body_text,
			tokenize='porter unicode61'
		);
		`

		if _, err := db.Exec(requestsFtsSchema); err != nil {
			return fmt.Errorf("failed to create requests_fts table: %w", err)
		}

		log.Println("✅ Created requests_fts FTS5 table")
	}

	// Create or repair extensions_fts virtual table.
	// [LAW:one-source-of-truth] extensions_fts is derived data; when schema drifts we recreate it.
	if err := ensureExtensionsFTSSchema(db); err != nil {
		return err
	}

	// Create todos_fts virtual table
	var todosFtsExists int
	err = db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='todos_fts'").Scan(&todosFtsExists)
	if err != nil {
		return fmt.Errorf("failed to check if todos_fts table exists: %w", err)
	}

	if todosFtsExists == 0 {
		todosFtsSchema := `
		CREATE VIRTUAL TABLE todos_fts USING fts5(
			todo_id UNINDEXED,
			content,
			status UNINDEXED,
			tags,
			tokenize='porter unicode61'
		);
		`

		if _, err := db.Exec(todosFtsSchema); err != nil {
			return fmt.Errorf("failed to create todos_fts table: %w", err)
		}

		log.Println("✅ Created todos_fts FTS5 table")
	}

	// Create plans_fts virtual table
	var plansFtsExists int
	err = db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='plans_fts'").Scan(&plansFtsExists)
	if err != nil {
		return fmt.Errorf("failed to check if plans_fts table exists: %w", err)
	}

	if plansFtsExists == 0 {
		plansFtsSchema := `
		CREATE VIRTUAL TABLE plans_fts USING fts5(
			plan_id UNINDEXED,
			title,
			goal,
			content,
			status UNINDEXED,
			tokenize='porter unicode61'
		);
		`

		if _, err := db.Exec(plansFtsSchema); err != nil {
			return fmt.Errorf("failed to create plans_fts table: %w", err)
		}

		log.Println("✅ Created plans_fts FTS5 table")
	}

	return nil
}

func ensureExtensionsFTSSchema(db *sql.DB) error {
	var extensionsFtsExists int
	err := db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='extensions_fts'").Scan(&extensionsFtsExists)
	if err != nil {
		return fmt.Errorf("failed to check if extensions_fts table exists: %w", err)
	}

	if extensionsFtsExists == 0 {
		if err := createExtensionsFTSTable(db); err != nil {
			return err
		}
		log.Println("✅ Created extensions_fts FTS5 table")
		return nil
	}

	hasExtensionID, err := tableHasColumn(db, "extensions_fts", "extension_id")
	if err != nil {
		return err
	}
	if hasExtensionID {
		if err := dropLegacyExtensionsFTSTriggers(db); err != nil {
			return err
		}
		return nil
	}

	log.Println("⚠️ Recreating extensions_fts with extension_id column")
	if _, err := db.Exec("DROP TABLE IF EXISTS extensions_fts"); err != nil {
		return fmt.Errorf("failed to drop incompatible extensions_fts table: %w", err)
	}
	if err := createExtensionsFTSTable(db); err != nil {
		return err
	}
	log.Println("✅ Recreated extensions_fts FTS5 table")
	if err := dropLegacyExtensionsFTSTriggers(db); err != nil {
		return err
	}

	return nil
}

func createExtensionsFTSTable(db *sql.DB) error {
	extensionsFtsSchema := `
	CREATE VIRTUAL TABLE extensions_fts USING fts5(
		extension_id UNINDEXED,
		type,
		name,
		description,
		metadata_text,
		tokenize='porter unicode61'
	);
	`

	if _, err := db.Exec(extensionsFtsSchema); err != nil {
		return fmt.Errorf("failed to create extensions_fts table: %w", err)
	}

	return nil
}

func tableHasColumn(db *sql.DB, tableName, columnName string) (bool, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", tableName))
	if err != nil {
		return false, fmt.Errorf("failed to inspect %s schema: %w", tableName, err)
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var columnType string
		var notNull int
		var defaultValue sql.NullString
		var primaryKey int
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			return false, fmt.Errorf("failed to read %s schema row: %w", tableName, err)
		}
		if name == columnName {
			return true, nil
		}
	}

	if err := rows.Err(); err != nil {
		return false, fmt.Errorf("failed to read %s schema: %w", tableName, err)
	}

	return false, nil
}

func dropLegacyExtensionsFTSTriggers(db *sql.DB) error {
	// [LAW:single-enforcer] SaveExtension is the single writer for extensions_fts.
	// Legacy triggers can drift from the FTS schema and block artifact indexing.
	statements := []string{
		"DROP TRIGGER IF EXISTS extensions_ai",
		"DROP TRIGGER IF EXISTS extensions_ad",
		"DROP TRIGGER IF EXISTS extensions_au",
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return fmt.Errorf("failed to drop legacy extensions FTS trigger: %w", err)
		}
	}

	return nil
}

// fts5Enabled returns true in production builds
func fts5Enabled() bool {
	return true
}

// indexRequestFTS indexes a request in the requests_fts table
func (s *SQLiteStorageService) indexRequestFTS(requestID, timestamp, method, endpoint, model, provider, toolNames, responseText, requestBodyText string) error {
	query := `
		INSERT OR REPLACE INTO requests_fts (request_id, timestamp, method, endpoint, model, provider, tool_names, response_text, request_body_text)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, requestID, timestamp, method, endpoint, model, provider, toolNames, responseText, requestBodyText)
	if err != nil {
		return fmt.Errorf("failed to index request in FTS: %w", err)
	}

	return nil
}

// indexExtensionFTS indexes an extension in the extensions_fts table
func (s *SQLiteStorageService) indexExtensionFTS(extensionID, typeStr, name, description, metadataText string) error {
	query := `
		INSERT OR REPLACE INTO extensions_fts (extension_id, type, name, description, metadata_text)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, extensionID, typeStr, name, description, metadataText)
	if err != nil {
		return fmt.Errorf("failed to index extension in FTS: %w", err)
	}

	return nil
}

// indexTodoFTS indexes a todo in the todos_fts table
func (s *SQLiteStorageService) indexTodoFTS(todoID, content, status, tags string) error {
	query := `
		INSERT OR REPLACE INTO todos_fts (todo_id, content, status, tags)
		VALUES (?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, todoID, content, status, tags)
	if err != nil {
		return fmt.Errorf("failed to index todo in FTS: %w", err)
	}

	return nil
}

// indexPlanFTS indexes a plan in the plans_fts table
func (s *SQLiteStorageService) indexPlanFTS(planID, title, goal, content, status string) error {
	query := `
		INSERT OR REPLACE INTO plans_fts (plan_id, title, goal, content, status)
		VALUES (?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, planID, title, goal, content, status)
	if err != nil {
		return fmt.Errorf("failed to index plan in FTS: %w", err)
	}

	return nil
}
