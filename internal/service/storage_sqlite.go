package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/brandon-fryslie/cc-viz/internal/config"
	"github.com/brandon-fryslie/cc-viz/internal/model"
	hybridstore "github.com/brandon-fryslie/cc-viz/internal/storagehybrid/hybrid"
)

type SQLiteStorageService struct {
	db     *sql.DB
	config *config.StorageConfig
	hybrid *hybridstore.Store
}

var _ RuntimeStorageService = (*SQLiteStorageService)(nil)

func NewSQLiteStorageService(cfg *config.StorageConfig) (*SQLiteStorageService, error) {
	// [LAW:single-enforcer] Configure write-lock waiting at the DB boundary so
	// all storage call paths share one concurrency policy.
	dbPath := cfg.DBPath + "?_journal_mode=WAL&_busy_timeout=30000&_synchronous=NORMAL"

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	service := &SQLiteStorageService{
		db:     db,
		config: cfg,
	}

	if err := service.createTables(); err != nil {
		return nil, fmt.Errorf("failed to create tables: %w", err)
	}

	// [LAW:one-source-of-truth] Canonical schema ownership (GORM) and search ownership (SQL)
	// are composed once through the hybrid store.
	hybrid, err := hybridstore.New(db)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize hybrid storage: %w", err)
	}
	if err := hybrid.Bootstrap(); err != nil {
		return nil, fmt.Errorf("failed to bootstrap hybrid storage: %w", err)
	}
	service.hybrid = hybrid

	return service, nil
}

// buildFTS5Query parses user input into an FTS5 query string.
// Supports quoted phrases ("exact phrase") and bare words.
// Bare words are AND-ed together so all must match.
// Quoted phrases are treated as exact substring matches by FTS5.
// Examples:
//
//	"hello world"        -> "hello" AND "world"
//	`"hello world"`      -> "hello world"  (phrase match)
//	`fix "auth bug" now` -> "fix" AND "auth bug" AND "now"
func buildFTS5Query(input string) string {
	var parts []string
	remaining := input

	for len(remaining) > 0 {
		remaining = strings.TrimSpace(remaining)
		if len(remaining) == 0 {
			break
		}

		if remaining[0] == '"' {
			// Find closing quote
			end := strings.Index(remaining[1:], `"`)
			if end == -1 {
				// No closing quote — treat rest as a phrase
				phrase := remaining[1:]
				if phrase != "" {
					escaped := strings.ReplaceAll(phrase, `"`, `""`)
					parts = append(parts, fmt.Sprintf(`"%s"`, escaped))
				}
				break
			}
			phrase := remaining[1 : end+1]
			remaining = remaining[end+2:]
			if phrase != "" {
				escaped := strings.ReplaceAll(phrase, `"`, `""`)
				parts = append(parts, fmt.Sprintf(`"%s"`, escaped))
			}
		} else {
			// Bare word — find next space or quote
			end := strings.IndexAny(remaining, ` "`)
			var word string
			if end == -1 {
				word = remaining
				remaining = ""
			} else {
				word = remaining[:end]
				remaining = remaining[end:]
			}
			if word != "" {
				escaped := strings.ReplaceAll(word, `"`, `""`)
				parts = append(parts, fmt.Sprintf(`"%s"`, escaped))
			}
		}
	}

	return strings.Join(parts, " AND ")
}

// dateFilterSQL returns SQL AND clauses and args for optional date range filtering.
func dateFilterSQL(column, after, before string) (string, []interface{}) {
	var clause string
	var args []interface{}
	if after != "" {
		clause += fmt.Sprintf(" AND %s >= ?", column)
		args = append(args, after)
	}
	if before != "" {
		clause += fmt.Sprintf(" AND %s <= ?", column)
		args = append(args, before)
	}
	return clause, args
}

func promptCacheHitRatePercent(inputTokens, cacheReadTokens, cacheCreationTokens int64) float64 {
	totalInput := inputTokens + cacheReadTokens + cacheCreationTokens
	if totalInput <= 0 {
		return 0
	}
	return (float64(cacheReadTokens) / float64(totalInput)) * 100
}

func (s *SQLiteStorageService) createTables() error {
	// [LAW:one-source-of-truth] Runtime storage owns sessions/conversations artifacts only.
	// Remove request-era schema objects if they still exist.
	if err := s.cleanupLegacyRequestSchema(); err != nil {
		return err
	}
	// ALWAYS run conversation search migrations (for both fresh and existing databases)
	if err := s.runConversationSearchMigrations(); err != nil {
		return err
	}

	// ALWAYS run Claude session data migrations (todos, plans)
	if err := s.runClaudeSessionDataMigrations(); err != nil {
		return err
	}

	// ALWAYS run extensions migrations
	if err := s.runExtensionMigrations(); err != nil {
		return err
	}

	// ALWAYS run subagent graph migrations
	if err := s.runSubagentGraphMigrations(); err != nil {
		return err
	}

	// ALWAYS run sessions migrations
	if err := s.runSessionsMigrations(); err != nil {
		return fmt.Errorf("sessions migrations failed: %w", err)
	}

	// ALWAYS run relationship maps migrations
	if err := s.runRelationshipMapsMigrations(); err != nil {
		return fmt.Errorf("relationship maps migrations failed: %w", err)
	}
	return nil
}

func (s *SQLiteStorageService) cleanupLegacyRequestSchema() error {
	statements := []string{
		"DROP INDEX IF EXISTS idx_timestamp",
		"DROP INDEX IF EXISTS idx_endpoint",
		"DROP INDEX IF EXISTS idx_model",
		"DROP INDEX IF EXISTS idx_provider",
		"DROP INDEX IF EXISTS idx_subagent",
		"DROP INDEX IF EXISTS idx_timestamp_provider",
		"DROP TABLE IF EXISTS requests_fts",
		"DROP TABLE IF EXISTS requests",
	}

	for _, stmt := range statements {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("failed to clean legacy schema statement %q: %w", stmt, err)
		}
	}
	log.Println("✅ Legacy request schema cleanup completed")
	return nil
}

// runConversationSearchMigrations creates the conversation search tables and FTS5 index
func (s *SQLiteStorageService) runConversationSearchMigrations() error {
	// Check if conversations table already exists
	var conversationsExists int
	err := s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='conversations'").Scan(&conversationsExists)
	if err != nil {
		return fmt.Errorf("failed to check if conversations table exists: %w", err)
	}

	if conversationsExists == 0 {
		// Create conversations metadata table
		conversationsSchema := `
		CREATE TABLE conversations (
			id TEXT PRIMARY KEY,
			project_path TEXT NOT NULL,
			project_name TEXT NOT NULL,
			start_time DATETIME,
			end_time DATETIME,
			message_count INTEGER DEFAULT 0,
			file_path TEXT NOT NULL UNIQUE,
			file_mtime DATETIME,
			indexed_at DATETIME
		);

		CREATE INDEX idx_conversations_project ON conversations(project_path);
		CREATE INDEX idx_conversations_mtime ON conversations(file_mtime DESC);
		CREATE INDEX idx_conversations_indexed ON conversations(indexed_at DESC);
		`

		if _, err := s.db.Exec(conversationsSchema); err != nil {
			return fmt.Errorf("failed to create conversations table: %w", err)
		}

		log.Println("✅ Created conversations table")
	}

	// Create FTS5 table using build-tag conditional function
	if err := createFTS5Table(s.db); err != nil {
		return err
	}

	// Check if conversation_messages table exists
	var messagesExists int
	err = s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='conversation_messages'").Scan(&messagesExists)
	if err != nil {
		return fmt.Errorf("failed to check if conversation_messages table exists: %w", err)
	}

	if messagesExists == 0 {
		// Create conversation_messages table to store full message data
		messagesSchema := `
		CREATE TABLE conversation_messages (
			uuid TEXT PRIMARY KEY,
			conversation_id TEXT NOT NULL,
			parent_uuid TEXT,
			type TEXT NOT NULL,
			role TEXT,
			timestamp DATETIME NOT NULL,
			cwd TEXT,
			git_branch TEXT,
			session_id TEXT,
			agent_id TEXT,
			is_sidechain BOOLEAN DEFAULT FALSE,
			request_id TEXT,
			model TEXT,
			input_tokens INTEGER DEFAULT 0,
			output_tokens INTEGER DEFAULT 0,
			cache_read_tokens INTEGER DEFAULT 0,
			cache_creation_tokens INTEGER DEFAULT 0,
			cache_creation_5m_tokens INTEGER DEFAULT 0,
			cache_creation_1h_tokens INTEGER DEFAULT 0,
			content_json TEXT,
			tool_use_json TEXT,
			tool_result_json TEXT,
			FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_messages_conversation ON conversation_messages(conversation_id);
		CREATE INDEX idx_messages_timestamp ON conversation_messages(timestamp);
		CREATE INDEX idx_messages_parent ON conversation_messages(parent_uuid);
		CREATE INDEX idx_messages_session ON conversation_messages(session_id);
		CREATE INDEX idx_messages_agent ON conversation_messages(agent_id);
		CREATE INDEX idx_messages_request ON conversation_messages(request_id);
		`

		if _, err := s.db.Exec(messagesSchema); err != nil {
			return fmt.Errorf("failed to create conversation_messages table: %w", err)
		}

		log.Println("✅ Created conversation_messages table")
	}

	// [LAW:one-source-of-truth] Prompt cache TTL split metrics are stored in canonical message rows.
	s.db.Exec("ALTER TABLE conversation_messages ADD COLUMN cache_creation_5m_tokens INTEGER DEFAULT 0")
	s.db.Exec("ALTER TABLE conversation_messages ADD COLUMN cache_creation_1h_tokens INTEGER DEFAULT 0")
	s.db.Exec(`
		UPDATE conversation_messages
		SET cache_creation_5m_tokens = cache_creation_tokens
		WHERE COALESCE(cache_creation_tokens, 0) > 0
		  AND COALESCE(cache_creation_5m_tokens, 0) = 0
		  AND COALESCE(cache_creation_1h_tokens, 0) = 0
	`)

	return nil
}

// runClaudeSessionDataMigrations creates tables for todos and plans
func (s *SQLiteStorageService) runClaudeSessionDataMigrations() error {
	// Check if claude_todos table exists
	var todosExists int
	err := s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='claude_todos'").Scan(&todosExists)
	if err != nil {
		return fmt.Errorf("failed to check if claude_todos table exists: %w", err)
	}

	if todosExists == 0 {
		// Create claude_todos table
		todosSchema := `
		CREATE TABLE claude_todos (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_uuid TEXT NOT NULL,
			agent_uuid TEXT,
			file_path TEXT NOT NULL,
			content TEXT NOT NULL,
			status TEXT NOT NULL,
			active_form TEXT,
			item_index INTEGER NOT NULL,
			modified_at DATETIME NOT NULL,
			indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(file_path, item_index)
		);

		CREATE INDEX idx_todos_session ON claude_todos(session_uuid);
		CREATE INDEX idx_todos_status ON claude_todos(status);
		CREATE INDEX idx_todos_modified ON claude_todos(modified_at);
		`

		if _, err := s.db.Exec(todosSchema); err != nil {
			return fmt.Errorf("failed to create claude_todos table: %w", err)
		}

		log.Println("✅ Created claude_todos table")
	}

	// Check if claude_todo_sessions table exists
	var todoSessionsExists int
	err = s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='claude_todo_sessions'").Scan(&todoSessionsExists)
	if err != nil {
		return fmt.Errorf("failed to check if claude_todo_sessions table exists: %w", err)
	}

	if todoSessionsExists == 0 {
		// Create claude_todo_sessions table
		todoSessionsSchema := `
		CREATE TABLE claude_todo_sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_uuid TEXT NOT NULL,
			agent_uuid TEXT,
			file_path TEXT UNIQUE NOT NULL,
			file_size INTEGER NOT NULL,
			todo_count INTEGER NOT NULL,
			pending_count INTEGER NOT NULL,
			in_progress_count INTEGER NOT NULL,
			completed_count INTEGER NOT NULL,
			modified_at DATETIME NOT NULL,
			indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
		`

		if _, err := s.db.Exec(todoSessionsSchema); err != nil {
			return fmt.Errorf("failed to create claude_todo_sessions table: %w", err)
		}

		log.Println("✅ Created claude_todo_sessions table")
	}

	// Check if claude_plans table exists
	var plansExists int
	err = s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='claude_plans'").Scan(&plansExists)
	if err != nil {
		return fmt.Errorf("failed to check if claude_plans table exists: %w", err)
	}

	if plansExists == 0 {
		// Create claude_plans table
		plansSchema := `
		CREATE TABLE claude_plans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			file_name TEXT UNIQUE NOT NULL,
			display_name TEXT NOT NULL,
			content TEXT NOT NULL,
			preview TEXT NOT NULL,
			file_size INTEGER NOT NULL,
			modified_at DATETIME NOT NULL,
			indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			session_uuid TEXT
		);

		CREATE INDEX idx_plans_modified ON claude_plans(modified_at);
		CREATE INDEX IF NOT EXISTS idx_plans_session ON claude_plans(session_uuid);
		`

		if _, err := s.db.Exec(plansSchema); err != nil {
			return fmt.Errorf("failed to create claude_plans table: %w", err)
		}

		log.Println("✅ Created claude_plans table")
	} else {
		// Existing table - add session_uuid column if it does not exist
		s.db.Exec("ALTER TABLE claude_plans ADD COLUMN session_uuid TEXT")
		s.db.Exec("CREATE INDEX IF NOT EXISTS idx_plans_session ON claude_plans(session_uuid)")

	}

	// [LAW:one-source-of-truth] indexed_at powers UI/index freshness and must exist/populate in one place.
	s.db.Exec("ALTER TABLE claude_todos ADD COLUMN indexed_at DATETIME")
	s.db.Exec("ALTER TABLE claude_todo_sessions ADD COLUMN indexed_at DATETIME")
	s.db.Exec("ALTER TABLE claude_plans ADD COLUMN indexed_at DATETIME")
	s.db.Exec("UPDATE claude_todos SET indexed_at = CURRENT_TIMESTAMP WHERE indexed_at IS NULL OR indexed_at = ''")
	s.db.Exec("UPDATE claude_todo_sessions SET indexed_at = CURRENT_TIMESTAMP WHERE indexed_at IS NULL OR indexed_at = ''")
	s.db.Exec("UPDATE claude_plans SET indexed_at = CURRENT_TIMESTAMP WHERE indexed_at IS NULL OR indexed_at = ''")

	return nil
}

// runExtensionMigrations creates tables for extensions
func (s *SQLiteStorageService) runExtensionMigrations() error {
	// Check if extensions table exists
	var extensionsExists int
	err := s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='extensions'").Scan(&extensionsExists)
	if err != nil {
		return fmt.Errorf("failed to check if extensions table exists: %w", err)
	}

	if extensionsExists == 0 {
		// Create fresh extensions table with all new columns
		extensionsSchema := `
		CREATE TABLE extensions (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			enabled BOOLEAN DEFAULT FALSE,
			source TEXT NOT NULL DEFAULT 'user',
			plugin_id TEXT,
			marketplace_id TEXT,
			file_path TEXT NOT NULL DEFAULT '',
			project_path TEXT,
			metadata_json TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX idx_extensions_type ON extensions(type);
		CREATE INDEX idx_extensions_enabled ON extensions(enabled);
		CREATE INDEX idx_extensions_source ON extensions(source);
		`

		if _, err := s.db.Exec(extensionsSchema); err != nil {
			return fmt.Errorf("failed to create extensions table: %w", err)
		}

		log.Println("✅ Created extensions table with source tracking")
	} else {
		// Existing table - run migrations to add new columns
		migrations := []string{
			"ALTER TABLE extensions ADD COLUMN source TEXT NOT NULL DEFAULT 'user'",
			"ALTER TABLE extensions ADD COLUMN plugin_id TEXT",
			"ALTER TABLE extensions ADD COLUMN marketplace_id TEXT",
			"ALTER TABLE extensions ADD COLUMN file_path TEXT NOT NULL DEFAULT ''",
			"ALTER TABLE extensions ADD COLUMN project_path TEXT",
			"ALTER TABLE extensions ADD COLUMN metadata_json TEXT",
			"ALTER TABLE extensions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
			"ALTER TABLE extensions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
		}

		for _, migration := range migrations {
			// Ignore errors - column may already exist
			s.db.Exec(migration)
		}

		// Create new index (ignore errors if it exists)
		s.db.Exec("CREATE INDEX IF NOT EXISTS idx_extensions_source ON extensions(source)")

		// Set source='user' for any existing rows without a source
		s.db.Exec("UPDATE extensions SET source='user' WHERE source IS NULL OR source = ''")

		log.Println("✅ Updated extensions table with source tracking columns")
	}

	return nil
}

// runSubagentGraphMigrations creates tables for subagent hierarchy tracking
func (s *SQLiteStorageService) runSubagentGraphMigrations() error {
	var tableExists int
	err := s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='subagent_graph'").Scan(&tableExists)
	if err != nil {
		return fmt.Errorf("failed to check if subagent_graph table exists: %w", err)
	}

	if tableExists == 0 {
		schema := `
		CREATE TABLE subagent_graph (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL,
			parent_agent_id TEXT,
			agent_id TEXT NOT NULL,
			first_message_uuid TEXT,
			last_message_uuid TEXT,
			message_count INTEGER DEFAULT 0,
			spawn_time DATETIME,
			end_time DATETIME,
			status TEXT DEFAULT 'unknown',
			is_sidechain BOOLEAN DEFAULT FALSE,
			file_path TEXT NOT NULL,
			file_mtime DATETIME,
			indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

			UNIQUE(session_id, agent_id)
		);

		CREATE INDEX idx_subagent_session ON subagent_graph(session_id);
		CREATE INDEX idx_subagent_parent ON subagent_graph(parent_agent_id, agent_id);
		CREATE INDEX idx_subagent_spawn ON subagent_graph(spawn_time DESC);
		CREATE INDEX idx_subagent_file ON subagent_graph(file_path);
		`

		if _, err := s.db.Exec(schema); err != nil {
			return fmt.Errorf("failed to create subagent_graph table: %w", err)
		}

		log.Println("✅ Created subagent_graph table")
	} else {
		// Table exists - check for self-referencing records (old bug)
		var selfRefCount int
		err := s.db.QueryRow("SELECT COUNT(*) FROM subagent_graph WHERE parent_agent_id = agent_id AND parent_agent_id IS NOT NULL").Scan(&selfRefCount)
		if err != nil {
			log.Printf("⚠️ Failed to check for self-referencing records: %v", err)
		} else if selfRefCount > 0 {
			log.Printf("⚠️ Found %d self-referencing records in subagent_graph (bug from previous implementation)", selfRefCount)
			log.Println("🔄 Clearing all subagent_graph records to force re-index with correct parent relationships...")

			result, err := s.db.Exec("DELETE FROM subagent_graph")
			if err != nil {
				log.Printf("❌ Failed to clear subagent_graph: %v", err)
			} else {
				rowsDeleted, _ := result.RowsAffected()
				log.Printf("✅ Cleared %d records from subagent_graph - will re-index on next startup", rowsDeleted)
			}
		}
	}

	return nil
}

// runSessionsMigrations creates the sessions table and migrates data from conversation_messages
func (s *SQLiteStorageService) runSessionsMigrations() error {
	// Check if sessions table exists
	var tableExists int
	err := s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='sessions'").Scan(&tableExists)
	if err != nil {
		return fmt.Errorf("failed to check if sessions table exists: %w", err)
	}

	if tableExists == 0 {
		// Create sessions table
		sessionsSchema := `
		CREATE TABLE sessions (
			id TEXT PRIMARY KEY,
			project_path TEXT,
			started_at DATETIME,
			ended_at DATETIME,
			conversation_count INTEGER DEFAULT 0,
			message_count INTEGER DEFAULT 0,
			agent_count INTEGER DEFAULT 0,
			todo_count INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX idx_sessions_project ON sessions(project_path);
		CREATE INDEX idx_sessions_started ON sessions(started_at);
		`

		if _, err := s.db.Exec(sessionsSchema); err != nil {
			return fmt.Errorf("failed to create sessions table: %w", err)
		}

		log.Println("✅ Created sessions table")

		// Populate sessions from existing conversation_messages data
		migrationQuery := `
		INSERT OR IGNORE INTO sessions (id, project_path, started_at, ended_at, message_count)
		SELECT
			cm.session_id,
			c.project_path,
			MIN(cm.timestamp),
			MAX(cm.timestamp),
			COUNT(*)
		FROM conversation_messages cm
		JOIN conversations c ON cm.conversation_id = c.id
		WHERE cm.session_id IS NOT NULL AND cm.session_id != ''
		GROUP BY cm.session_id
		`

		result, err := s.db.Exec(migrationQuery)
		if err != nil {
			return fmt.Errorf("failed to migrate sessions data: %w", err)
		}

		rowsAffected, _ := result.RowsAffected()
		log.Printf("✅ Migrated %d sessions from conversation_messages", rowsAffected)
	}

	// [LAW:single-enforcer] Session creation timestamps are normalized here so
	// session APIs can treat created_at as non-null and avoid per-callsite fallbacks.
	s.db.Exec("ALTER TABLE sessions ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP")
	s.db.Exec(`
		UPDATE sessions
		SET created_at = COALESCE(created_at, started_at, CURRENT_TIMESTAMP)
		WHERE created_at IS NULL OR created_at = ''
	`)

	return nil
}

// runRelationshipMapsMigrations creates tables for session-conversation and session-file relationships
func (s *SQLiteStorageService) runRelationshipMapsMigrations() error {
	// Check if session_conversation_map table exists
	var scmExists int
	err := s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='session_conversation_map'").Scan(&scmExists)
	if err != nil {
		return fmt.Errorf("failed to check if session_conversation_map table exists: %w", err)
	}

	if scmExists == 0 {
		// Create session_conversation_map table
		scmSchema := `
		CREATE TABLE session_conversation_map (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL,
			conversation_id TEXT NOT NULL,
			first_message_uuid TEXT,
			last_message_uuid TEXT,
			message_count INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(session_id, conversation_id),
			FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
			FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_scm_session ON session_conversation_map(session_id);
		CREATE INDEX idx_scm_conversation ON session_conversation_map(conversation_id);
		`

		if _, err := s.db.Exec(scmSchema); err != nil {
			return fmt.Errorf("failed to create session_conversation_map table: %w", err)
		}

		log.Println("✅ Created session_conversation_map table")

		// Populate session_conversation_map from existing conversation_messages
		populateQuery := `
		INSERT OR IGNORE INTO session_conversation_map
			(session_id, conversation_id, first_message_uuid, last_message_uuid, message_count)
		SELECT
			session_id,
			conversation_id,
			MIN(uuid),
			MAX(uuid),
			COUNT(*)
		FROM conversation_messages
		WHERE session_id IS NOT NULL AND session_id != ''
		GROUP BY session_id, conversation_id
		`

		result, err := s.db.Exec(populateQuery)
		if err != nil {
			return fmt.Errorf("failed to populate session_conversation_map: %w", err)
		}

		rowsAffected, _ := result.RowsAffected()
		log.Printf("✅ Populated session_conversation_map with %d relationships", rowsAffected)
	}

	// Check if session_file_changes table exists
	var sfcExists int
	err = s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='session_file_changes'").Scan(&sfcExists)
	if err != nil {
		return fmt.Errorf("failed to check if session_file_changes table exists: %w", err)
	}

	if sfcExists == 0 {
		// Create session_file_changes table
		sfcSchema := `
		CREATE TABLE session_file_changes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id TEXT NOT NULL,
			file_path TEXT NOT NULL,
			change_type TEXT,
			tool_name TEXT,
			message_uuid TEXT,
			timestamp DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_sfc_session ON session_file_changes(session_id);
		CREATE INDEX idx_sfc_path ON session_file_changes(file_path);
		CREATE INDEX idx_sfc_timestamp ON session_file_changes(timestamp DESC);
		`

		if _, err := s.db.Exec(sfcSchema); err != nil {
			return fmt.Errorf("failed to create session_file_changes table: %w", err)
		}

		log.Println("✅ Created session_file_changes table")
	}
	// [LAW:one-source-of-truth] message_uuid identifies whether a tool-use message
	// has already been processed into session_file_changes.
	s.db.Exec("CREATE INDEX IF NOT EXISTS idx_sfc_message_uuid ON session_file_changes(message_uuid)")
	s.db.Exec("CREATE INDEX IF NOT EXISTS idx_sfc_session ON session_file_changes(session_id)")
	s.db.Exec("CREATE INDEX IF NOT EXISTS idx_sfc_path ON session_file_changes(file_path)")
	s.db.Exec("CREATE INDEX IF NOT EXISTS idx_sfc_timestamp ON session_file_changes(timestamp DESC)")

	// Check if plan_session_map table exists
	var psmExists int
	err = s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='plan_session_map'").Scan(&psmExists)
	if err != nil {
		return fmt.Errorf("failed to check if plan_session_map table exists: %w", err)
	}

	if psmExists == 0 {
		// Create plan_session_map table
		psmSchema := `
		CREATE TABLE plan_session_map (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			plan_id INTEGER NOT NULL,
			session_id TEXT NOT NULL,
			relationship TEXT,
			confidence TEXT,
			discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(plan_id, session_id),
			FOREIGN KEY (plan_id) REFERENCES claude_plans(id) ON DELETE CASCADE,
			FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_psm_plan ON plan_session_map(plan_id);
		CREATE INDEX idx_psm_session ON plan_session_map(session_id);
		`

		if _, err := s.db.Exec(psmSchema); err != nil {
			return fmt.Errorf("failed to create plan_session_map table: %w", err)
		}

		log.Println("✅ Created plan_session_map table")
	}

	return nil
}

// GetStats returns aggregated statistics for the dashboard - uses SQL aggregation
func (s *SQLiteStorageService) GetStats(startDate, endDate string) (*model.DashboardStats, error) {
	stats := &model.DashboardStats{
		DailyStats: make([]model.DailyTokens, 0),
	}

	// SQL aggregation - query conversation_messages for token data
	// Deduplicate by request_id: Claude Code writes one JSONL entry per content block
	// in a streaming response, each carrying the same usage object. We take MAX per
	// request_id to count tokens only once per API request.
	query := `
		SELECT
			DATE(timestamp) as date,
			COALESCE(model, 'unknown') as model,
			COUNT(*) as requests,
			SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_read_tokens, 0) + COALESCE(cache_creation_tokens, 0)) as tokens
		FROM (
			SELECT
				COALESCE(request_id, uuid) as dedup_key,
				MIN(timestamp) as timestamp,
				MAX(model) as model,
				MAX(input_tokens) as input_tokens,
				MAX(output_tokens) as output_tokens,
				MAX(cache_read_tokens) as cache_read_tokens,
				MAX(cache_creation_tokens) as cache_creation_tokens
			FROM conversation_messages
			WHERE timestamp >= ? AND timestamp < ?
				AND role IN ('user', 'assistant')
			GROUP BY dedup_key
		)
		GROUP BY date, model
		ORDER BY date
	`

	rows, err := s.db.Query(query, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query stats: %w", err)
	}
	defer rows.Close()

	// Aggregate by date (models already grouped by SQL)
	dailyMap := make(map[string]*model.DailyTokens)

	for rows.Next() {
		var date, modelName string
		var requests int
		var tokens int64

		if err := rows.Scan(&date, &modelName, &requests, &tokens); err != nil {
			continue
		}

		if daily, ok := dailyMap[date]; ok {
			daily.Tokens += tokens
			daily.Requests += requests
			daily.Models[modelName] = model.ModelStats{
				Tokens:   tokens,
				Requests: requests,
			}
		} else {
			dailyMap[date] = &model.DailyTokens{
				Date:     date,
				Tokens:   tokens,
				Requests: requests,
				Models: map[string]model.ModelStats{
					modelName: {
						Tokens:   tokens,
						Requests: requests,
					},
				},
			}
		}
	}

	// Convert map to slice
	for _, v := range dailyMap {
		stats.DailyStats = append(stats.DailyStats, *v)
	}

	return stats, nil
}

// GetHourlyStats returns hourly breakdown for a specific time range - uses SQL aggregation
func (s *SQLiteStorageService) GetHourlyStats(startTime, endTime string) (*model.HourlyStatsResponse, error) {
	// Deduplicate by request_id before aggregating (see GetStats comment)
	query := `
		SELECT
			CAST(strftime('%H', timestamp) AS INTEGER) as hour,
			COALESCE(model, 'unknown') as model,
			COUNT(*) as requests,
			SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_read_tokens, 0) + COALESCE(cache_creation_tokens, 0)) as tokens
		FROM (
			SELECT
				COALESCE(request_id, uuid) as dedup_key,
				MIN(timestamp) as timestamp,
				MAX(model) as model,
				MAX(input_tokens) as input_tokens,
				MAX(output_tokens) as output_tokens,
				MAX(cache_read_tokens) as cache_read_tokens,
				MAX(cache_creation_tokens) as cache_creation_tokens
			FROM conversation_messages
			WHERE timestamp >= ? AND timestamp < ?
				AND role IN ('user', 'assistant')
			GROUP BY dedup_key
		)
		GROUP BY hour, model
		ORDER BY hour
	`

	rows, err := s.db.Query(query, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to query hourly stats: %w", err)
	}
	defer rows.Close()

	hourlyMap := make(map[int]*model.HourlyTokens)
	var totalTokens int64
	var totalRequests int

	for rows.Next() {
		var hour, requests int
		var modelName string
		var tokens int64

		if err := rows.Scan(&hour, &modelName, &requests, &tokens); err != nil {
			continue
		}

		totalTokens += tokens
		totalRequests += requests

		if hourly, ok := hourlyMap[hour]; ok {
			hourly.Tokens += tokens
			hourly.Requests += requests
			hourly.Models[modelName] = model.ModelStats{
				Tokens:   tokens,
				Requests: requests,
			}
		} else {
			hourlyMap[hour] = &model.HourlyTokens{
				Hour:     hour,
				Tokens:   tokens,
				Requests: requests,
				Models: map[string]model.ModelStats{
					modelName: {
						Tokens:   tokens,
						Requests: requests,
					},
				},
			}
		}
	}

	// Convert map to slice
	hourlyStats := make([]model.HourlyTokens, 0)
	for _, v := range hourlyMap {
		hourlyStats = append(hourlyStats, *v)
	}

	return &model.HourlyStatsResponse{
		HourlyStats:     hourlyStats,
		TodayTokens:     totalTokens,
		TodayRequests:   totalRequests,
		AvgResponseTime: 0,
	}, nil
}

// GetModelStats returns model breakdown for a specific time range - uses SQL aggregation
func (s *SQLiteStorageService) GetModelStats(startTime, endTime string) (*model.ModelStatsResponse, error) {
	// [LAW:one-source-of-truth] Query conversation_messages, deduplicating by request_id.
	// Same pattern as GetStats: each streaming response has multiple JSONL entries with
	// identical usage data, so we take MAX per request_id to count tokens only once.
	query := `
		SELECT
			COALESCE(model, 'unknown') as model,
			COUNT(*) as requests,
			SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_read_tokens, 0) + COALESCE(cache_creation_tokens, 0)) as tokens
		FROM (
			SELECT
				COALESCE(request_id, uuid) as dedup_key,
				MAX(model) as model,
				MAX(input_tokens) as input_tokens,
				MAX(output_tokens) as output_tokens,
				MAX(cache_read_tokens) as cache_read_tokens,
				MAX(cache_creation_tokens) as cache_creation_tokens
			FROM conversation_messages
			WHERE timestamp >= ? AND timestamp < ?
				AND role IN ('user', 'assistant')
			GROUP BY dedup_key
		)
		GROUP BY model
		ORDER BY tokens DESC
	`

	rows, err := s.db.Query(query, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to query model stats: %w", err)
	}
	defer rows.Close()

	modelStats := make([]model.ModelTokens, 0)

	for rows.Next() {
		var modelName string
		var requests int
		var tokens int64

		if err := rows.Scan(&modelName, &requests, &tokens); err != nil {
			continue
		}

		modelStats = append(modelStats, model.ModelTokens{
			Model:    modelName,
			Tokens:   tokens,
			Requests: requests,
		})
	}

	return &model.ModelStatsResponse{
		ModelStats: modelStats,
	}, nil
}

func (s *SQLiteStorageService) Close() error {
	return s.db.Close()
}

// SearchConversations performs FTS5 search on conversation content (with fallback for test mode)
// Updated SearchConversations with snippet extraction
func (s *SQLiteStorageService) SearchConversations(opts model.SearchOptions) (*model.SearchResults, error) {
	if strings.TrimSpace(opts.Query) == "" {
		return &model.SearchResults{
			Query:   opts.Query,
			Results: []*model.ConversationMatch{},
			Total:   0,
			Limit:   opts.Limit,
			Offset:  opts.Offset,
		}, nil
	}

	ftsQuery := buildFTS5Query(opts.Query)

	// Build the main query - now includes content_text for snippet extraction
	query := `
		SELECT
			c.id AS conversation_id,
			c.project_name,
			c.project_path,
			c.end_time AS last_activity,
			COUNT(f.rowid) AS match_count,
			(SELECT f2.content_text 
			 FROM conversations_fts f2 
			 WHERE f2.conversation_id = c.id 
			   AND f2.content_text MATCH ? 
			 LIMIT 1) AS first_match_content
		FROM conversations_fts f
		JOIN conversations c ON f.conversation_id = c.id
		WHERE conversations_fts MATCH ?
	`
	args := []interface{}{ftsQuery, ftsQuery}

	// Add project filter if specified
	if opts.ProjectPath != "" {
		query += " AND c.project_path = ?"
		args = append(args, opts.ProjectPath)
	}

	dateClause2, dateArgs2 := dateFilterSQL("c.end_time", opts.After, opts.Before)
	query += dateClause2
	args = append(args, dateArgs2...)

	query += `
		GROUP BY c.id
		ORDER BY match_count DESC, c.end_time DESC
	`

	// Get total count first
	countQuery := `
		SELECT COUNT(DISTINCT c.id)
		FROM conversations_fts f
		JOIN conversations c ON f.conversation_id = c.id
		WHERE conversations_fts MATCH ?
	`
	countArgs := []interface{}{ftsQuery}
	if opts.ProjectPath != "" {
		countQuery += " AND c.project_path = ?"
		countArgs = append(countArgs, opts.ProjectPath)
	}

	dateClause, dateArgs := dateFilterSQL("c.end_time", opts.After, opts.Before)
	countQuery += dateClause
	countArgs = append(countArgs, dateArgs...)

	var total int
	if err := s.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	// Add pagination
	query += " LIMIT ? OFFSET ?"
	args = append(args, opts.Limit, opts.Offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query conversations: %w", err)
	}
	defer rows.Close()

	results := make([]*model.ConversationMatch, 0)
	for rows.Next() {
		var match model.ConversationMatch
		var lastActivity sql.NullString
		var content sql.NullString

		if err := rows.Scan(
			&match.ConversationID,
			&match.ProjectName,
			&match.ProjectPath,
			&lastActivity,
			&match.MatchCount,
			&content,
		); err != nil {
			continue
		}

		if lastActivity.Valid {
			if t, err := time.Parse(time.RFC3339, lastActivity.String); err == nil {
				match.LastActivity = t
			}
		}

		// Extract snippet with highlights
		if content.Valid && content.String != "" {
			snippet := ExtractSnippet(content.String, opts.Query, 100)
			match.Preview = snippet.Snippet
			match.HighlightStart = snippet.HighlightStart
			match.HighlightEnd = snippet.HighlightEnd
		}

		results = append(results, &match)
	}

	return &model.SearchResults{
		Query:   opts.Query,
		Results: results,
		Total:   total,
		Limit:   opts.Limit,
		Offset:  opts.Offset,
	}, nil
}

// SearchUnified performs full-text search across all data types
func (s *SQLiteStorageService) SearchUnified(query string, dataTypes []string, limit, offset int, after, before string) (*model.UnifiedSearchResults, error) {
	if s.hybrid != nil && s.hybrid.Search != nil {
		dataTypes = s.hybrid.Search.NormalizeDataTypes(dataTypes)
	} else if len(dataTypes) == 0 {
		// [LAW:one-source-of-truth] Keep default search domains stable at one callsite.
		dataTypes = []string{"conversations", "extensions", "todos", "plans"}
	}

	// Build a set for easier checking
	typeSet := make(map[string]bool)
	for _, dt := range dataTypes {
		typeSet[dt] = true
	}

	results := &model.UnifiedSearchResults{
		Query: query,
	}

	// Search conversations
	if typeSet["conversations"] {
		convs, err := s.SearchConversations(model.SearchOptions{
			Query:  query,
			Limit:  limit,
			Offset: offset,
			After:  after,
			Before: before,
		})
		if err != nil {
			log.Printf("Warning: conversation search failed: %v", err)
		} else {
			results.Conversations = convs
		}
	}

	// Search extensions
	if typeSet["extensions"] {
		exts, total, err := s.SearchExtensions(query, "", "", limit, offset, after, before)
		if err != nil {
			log.Printf("Warning: extension search failed: %v", err)
		} else {
			results.Extensions = model.UnifiedSearchSection{
				Results: exts,
				Total:   total,
				Limit:   limit,
				Offset:  offset,
			}
		}
	}

	// Search todos
	if typeSet["todos"] {
		todos, total, err := s.SearchTodos(query, "", limit, offset, after, before)
		if err != nil {
			log.Printf("Warning: todo search failed: %v", err)
		} else {
			results.Todos = model.UnifiedSearchSection{
				Results: todos,
				Total:   total,
				Limit:   limit,
				Offset:  offset,
			}
		}
	}

	// Search plans
	if typeSet["plans"] {
		plans, total, err := s.SearchPlans(query, "", limit, offset, after, before)
		if err != nil {
			log.Printf("Warning: plan search failed: %v", err)
		} else {
			results.Plans = model.UnifiedSearchSection{
				Results: plans,
				Total:   total,
				Limit:   limit,
				Offset:  offset,
			}
		}
	}

	return results, nil
}

// GetIndexedConversations returns conversations from the database index - very fast
func (s *SQLiteStorageService) GetIndexedConversations(limit int) ([]*model.IndexedConversation, error) {
	if s.hybrid != nil && s.hybrid.Canonical != nil {
		return s.hybrid.Canonical.GetIndexedConversations(limit)
	}

	query := `
		SELECT id, project_path, project_name, start_time, end_time, message_count
		FROM conversations
		WHERE message_count > 0
		ORDER BY end_time DESC
	`

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	log.Printf("🔍 GetIndexedConversations: limit=%d, final query: %s", limit, query)

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query indexed conversations: %w", err)
	}
	defer rows.Close()

	var conversations []*model.IndexedConversation
	for rows.Next() {
		var conv model.IndexedConversation
		var startTime, endTime sql.NullString

		if err := rows.Scan(
			&conv.ID,
			&conv.ProjectPath,
			&conv.ProjectName,
			&startTime,
			&endTime,
			&conv.MessageCount,
		); err != nil {
			continue
		}

		if startTime.Valid {
			if t, err := time.Parse(time.RFC3339, startTime.String); err == nil {
				conv.StartTime = t
			}
		}
		if endTime.Valid {
			if t, err := time.Parse(time.RFC3339, endTime.String); err == nil {
				conv.EndTime = t
			}
		}

		conversations = append(conversations, &conv)
	}

	return conversations, nil
}

// GetConversationFilePath returns the file path and project path for a conversation by ID
func (s *SQLiteStorageService) GetConversationFilePath(conversationID string) (string, string, error) {
	var filePath, projectPath string
	err := s.db.QueryRow(
		"SELECT file_path, project_path FROM conversations WHERE id = ?",
		conversationID,
	).Scan(&filePath, &projectPath)
	if err != nil {
		return "", "", fmt.Errorf("conversation not found: %w", err)
	}
	return filePath, projectPath, nil
}

// GetConversationMessages returns messages for a conversation from the database
func (s *SQLiteStorageService) GetConversationMessages(conversationID string, limit, offset int) ([]*model.DBConversationMessage, int, error) {
	// Get total count
	var total int
	err := s.db.QueryRow("SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = ?", conversationID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count messages: %w", err)
	}

	// Set default limit
	if limit <= 0 {
		limit = 100
	}

	query := `
		SELECT uuid, conversation_id, parent_uuid, type, role, timestamp,
		       cwd, git_branch, session_id, agent_id, is_sidechain,
		       request_id, model, input_tokens, output_tokens,
		       cache_read_tokens, cache_creation_tokens, cache_creation_5m_tokens, cache_creation_1h_tokens, content_json
		FROM conversation_messages
		WHERE conversation_id = ?
		ORDER BY timestamp ASC
		LIMIT ? OFFSET ?
	`

	rows, err := s.db.Query(query, conversationID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []*model.DBConversationMessage
	for rows.Next() {
		var msg model.DBConversationMessage
		var parentUUID, role, cwd, gitBranch, sessionID, agentID, requestID, modelName sql.NullString
		var contentJSON sql.NullString
		var timestampStr string

		err := rows.Scan(
			&msg.UUID,
			&msg.ConversationID,
			&parentUUID,
			&msg.Type,
			&role,
			&timestampStr,
			&cwd,
			&gitBranch,
			&sessionID,
			&agentID,
			&msg.IsSidechain,
			&requestID,
			&modelName,
			&msg.InputTokens,
			&msg.OutputTokens,
			&msg.CacheReadTokens,
			&msg.CacheCreationTokens,
			&msg.CacheCreation5mTokens,
			&msg.CacheCreation1hTokens,
			&contentJSON,
		)
		if err != nil {
			log.Printf("⚠️ Error scanning message row: %v", err)
			continue
		}

		// Parse timestamp
		if t, err := time.Parse(time.RFC3339, timestampStr); err == nil {
			msg.Timestamp = t
		}

		// Handle nullable fields
		if parentUUID.Valid {
			msg.ParentUUID = &parentUUID.String
		}
		if role.Valid {
			msg.Role = role.String
		}
		if cwd.Valid {
			msg.CWD = cwd.String
		}
		if gitBranch.Valid {
			msg.GitBranch = gitBranch.String
		}
		if sessionID.Valid {
			msg.SessionID = sessionID.String
		}
		if agentID.Valid {
			msg.AgentID = agentID.String
		}
		if requestID.Valid {
			msg.RequestID = requestID.String
		}
		if modelName.Valid {
			msg.Model = modelName.String
		}
		if contentJSON.Valid {
			msg.Content = json.RawMessage(contentJSON.String)
		}

		messages = append(messages, &msg)
	}

	return messages, total, nil
}

// GetConversationMessagesWithSubagents returns messages including subagent messages merged by timestamp
func (s *SQLiteStorageService) GetConversationMessagesWithSubagents(conversationID string, limit, offset int) ([]*model.DBConversationMessage, int, error) {
	// Get messages from parent conversation + all subagent conversations
	// Subagent messages have session_id matching the parent conversation_id

	// Set default limit
	if limit <= 0 {
		limit = 100
	}

	// First get the count of all messages (parent + subagents)
	var total int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM conversation_messages
		WHERE conversation_id = ? OR session_id = ?
	`, conversationID, conversationID).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count messages: %w", err)
	}

	// Get all messages from parent and subagents, ordered by timestamp
	query := `
		SELECT uuid, conversation_id, parent_uuid, type, role, timestamp,
		       cwd, git_branch, session_id, agent_id, is_sidechain,
		       request_id, model, input_tokens, output_tokens,
		       cache_read_tokens, cache_creation_tokens, cache_creation_5m_tokens, cache_creation_1h_tokens, content_json
		FROM conversation_messages
		WHERE conversation_id = ? OR session_id = ?
		ORDER BY timestamp ASC
		LIMIT ? OFFSET ?
	`

	rows, err := s.db.Query(query, conversationID, conversationID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []*model.DBConversationMessage
	for rows.Next() {
		var msg model.DBConversationMessage
		var parentUUID, role, cwd, gitBranch, sessionID, agentID, requestID, modelName sql.NullString
		var contentJSON sql.NullString
		var timestampStr string

		err := rows.Scan(
			&msg.UUID,
			&msg.ConversationID,
			&parentUUID,
			&msg.Type,
			&role,
			&timestampStr,
			&cwd,
			&gitBranch,
			&sessionID,
			&agentID,
			&msg.IsSidechain,
			&requestID,
			&modelName,
			&msg.InputTokens,
			&msg.OutputTokens,
			&msg.CacheReadTokens,
			&msg.CacheCreationTokens,
			&msg.CacheCreation5mTokens,
			&msg.CacheCreation1hTokens,
			&contentJSON,
		)
		if err != nil {
			log.Printf("⚠️ Error scanning message row: %v", err)
			continue
		}

		// Parse timestamp
		if t, err := time.Parse(time.RFC3339, timestampStr); err == nil {
			msg.Timestamp = t
		}

		// Handle nullable fields
		if parentUUID.Valid {
			msg.ParentUUID = &parentUUID.String
		}
		if role.Valid {
			msg.Role = role.String
		}
		if cwd.Valid {
			msg.CWD = cwd.String
		}
		if gitBranch.Valid {
			msg.GitBranch = gitBranch.String
		}
		if sessionID.Valid {
			msg.SessionID = sessionID.String
		}
		if agentID.Valid {
			msg.AgentID = agentID.String
		}
		if requestID.Valid {
			msg.RequestID = requestID.String
		}
		if modelName.Valid {
			msg.Model = modelName.String
		}
		if contentJSON.Valid {
			msg.Content = json.RawMessage(contentJSON.String)
		}

		messages = append(messages, &msg)
	}

	return messages, total, nil
}

// ReindexConversations triggers a full re-index by clearing indexed_at timestamps
func (s *SQLiteStorageService) ReindexConversations() error {
	_, err := s.db.Exec("UPDATE conversations SET indexed_at = NULL")
	if err != nil {
		return fmt.Errorf("failed to clear indexed_at: %w", err)
	}
	log.Println("🔄 Cleared indexed_at timestamps - conversations will be re-indexed")
	return nil
}

// DB returns the underlying database connection - for subagent indexer use
func (s *SQLiteStorageService) DB() *sql.DB {
	return s.db
}

// GetDB returns the underlying database connection for internal package use only (DEPRECATED: use DB())
func (s *SQLiteStorageService) GetDB() *sql.DB {
	return s.db
}

// Extension storage methods

// GetExtensionsFiltered returns extensions with optional type, source, and search filters
func (s *SQLiteStorageService) GetExtensionsFiltered(extType, source, search string) ([]*model.Extension, error) {
	query := `SELECT id, type, name, description, enabled, source, plugin_id, marketplace_id, file_path, project_path, 
	                 metadata_json, created_at, updated_at FROM extensions WHERE 1=1`
	var args []interface{}

	if extType != "" {
		query += " AND type = ?"
		args = append(args, extType)
	}

	if source != "" {
		query += " AND source = ?"
		args = append(args, source)
	}

	if search != "" {
		searchPattern := "%" + search + "%"
		query += " AND (name LIKE ? OR description LIKE ?)"
		args = append(args, searchPattern, searchPattern)
	}

	query += " ORDER BY type, name"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query extensions: %w", err)
	}
	defer rows.Close()

	var extensions []*model.Extension
	for rows.Next() {
		ext, err := scanExtension(rows)
		if err != nil {
			return nil, err
		}
		extensions = append(extensions, ext)
	}

	return extensions, nil
}

// GetExtensions returns extensions filtered by type (legacy method for compatibility)
func (s *SQLiteStorageService) GetExtensions(extType string) ([]*model.Extension, error) {
	return s.GetExtensionsFiltered(extType, "", "")
}

// GetExtension returns a single extension by type and ID
func (s *SQLiteStorageService) GetExtension(extType, id string) (*model.Extension, error) {
	query := `SELECT id, type, name, description, enabled, source, plugin_id, marketplace_id, file_path, project_path,
	                 metadata_json, created_at, updated_at FROM extensions WHERE type = ? AND id = ?`

	row := s.db.QueryRow(query, extType, id)
	ext, err := scanExtensionRow(row)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("extension not found")
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query extension: %w", err)
	}

	return ext, nil
}

// SaveExtension inserts or updates an extension
func (s *SQLiteStorageService) SaveExtension(ext *model.Extension) error {
	query := `INSERT OR REPLACE INTO extensions
	          (id, type, name, description, enabled, source, plugin_id, marketplace_id, file_path, project_path, metadata_json, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`

	_, err := s.db.Exec(query,
		ext.ID,
		ext.Type,
		ext.Name,
		ext.Description,
		ext.Enabled,
		ext.Source,
		ext.PluginID,
		ext.MarketplaceID,
		ext.FilePath,
		ext.ProjectPath,
		string(ext.MetadataJSON),
	)

	if err != nil {
		return err
	}

	// Index extension in FTS5 for full-text search
	if fts5Enabled() {
		metadataText := ""
		if len(ext.MetadataJSON) > 0 {
			metadataText = string(ext.MetadataJSON[:min(len(ext.MetadataJSON), 500)])
		}
		if err := s.indexExtensionFTS(ext.ID, ext.Type, ext.Name, ext.Description, metadataText); err != nil {
			// Log error but don't fail the save
			log.Printf("⚠️ Warning: failed to index extension %s in FTS: %v", ext.ID, err)
		}
	}

	return nil
}

// SearchExtensions performs full-text search on extensions
func (s *SQLiteStorageService) SearchExtensions(query string, extType, source string, limit, offset int, after, before string) ([]*model.ExtensionSearchResult, int, error) {
	if strings.TrimSpace(query) == "" {
		return []*model.ExtensionSearchResult{}, 0, nil
	}

	ftsQuery := buildFTS5Query(query)

	// Get total count
	countQuery := `
		SELECT COUNT(DISTINCT e.id)
		FROM extensions_fts f
		JOIN extensions e ON f.extension_id = e.id
		WHERE extensions_fts MATCH ?
	`
	countArgs := []interface{}{ftsQuery}

	if extType != "" {
		countQuery += " AND e.type = ?"
		countArgs = append(countArgs, extType)
	}
	if source != "" {
		countQuery += " AND e.source = ?"
		countArgs = append(countArgs, source)
	}

	dateClause, dateArgs := dateFilterSQL("e.updated_at", after, before)
	countQuery += dateClause
	countArgs = append(countArgs, dateArgs...)

	var total int
	if err := s.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to get total count: %w", err)
	}

	// Build results query - get match count and description for snippet
	resultQuery := `
		SELECT DISTINCT
			e.id,
			e.type,
			e.name,
			e.source,
			e.description,
			COUNT(f.rowid) as match_count,
			e.updated_at
		FROM extensions_fts f
		JOIN extensions e ON f.extension_id = e.id
		WHERE extensions_fts MATCH ?
	`
	queryArgs := []interface{}{ftsQuery}

	if extType != "" {
		resultQuery += " AND e.type = ?"
		queryArgs = append(queryArgs, extType)
	}
	if source != "" {
		resultQuery += " AND e.source = ?"
		queryArgs = append(queryArgs, source)
	}

	dateClause2, dateArgs2 := dateFilterSQL("e.updated_at", after, before)
	resultQuery += dateClause2
	queryArgs = append(queryArgs, dateArgs2...)

	resultQuery += `
		GROUP BY e.id
		ORDER BY match_count DESC, e.updated_at DESC
		LIMIT ? OFFSET ?
	`
	queryArgs = append(queryArgs, limit, offset)

	rows, err := s.db.Query(resultQuery, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query extensions: %w", err)
	}
	defer rows.Close()

	var results []*model.ExtensionSearchResult
	for rows.Next() {
		var result model.ExtensionSearchResult
		var description sql.NullString
		var updatedAt sql.NullString

		if err := rows.Scan(
			&result.ID,
			&result.Type,
			&result.Name,
			&result.Source,
			&description,
			&result.MatchCount,
			&updatedAt,
		); err != nil {
			continue
		}

		if updatedAt.Valid {
			result.UpdatedAt = updatedAt.String
		}

		// Extract snippet with highlights from description
		if description.Valid && description.String != "" {
			snippet := ExtractSnippet(description.String, query, 100)
			result.Snippet = snippet.Snippet
			result.HighlightStart = snippet.HighlightStart
			result.HighlightEnd = snippet.HighlightEnd
		}

		results = append(results, &result)
	}

	return results, total, nil
}

// DeleteExtension removes an extension by ID
func (s *SQLiteStorageService) DeleteExtension(id string) error {
	_, err := s.db.Exec("DELETE FROM extensions WHERE id = ?", id)
	return err
}

// UpdateExtensionEnabled toggles extension enabled state
func (s *SQLiteStorageService) UpdateExtensionEnabled(id string, enabled bool) error {
	query := "UPDATE extensions SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
	_, err := s.db.Exec(query, enabled, id)
	if err != nil {
		return fmt.Errorf("failed to update extension: %w", err)
	}
	return nil
}

// GetExtensionStats returns aggregate statistics about extensions
func (s *SQLiteStorageService) GetExtensionStats() (*model.ExtensionStatsResponse, error) {
	// Get total count and by type
	rows, err := s.db.Query("SELECT type, COUNT(*) as count FROM extensions GROUP BY type")
	if err != nil {
		return nil, fmt.Errorf("failed to query extension stats: %w", err)
	}
	defer rows.Close()

	byType := make(map[string]int)
	var total int

	for rows.Next() {
		var extType string
		var count int
		if err := rows.Scan(&extType, &count); err != nil {
			return nil, fmt.Errorf("failed to scan extension stats: %w", err)
		}
		byType[extType] = count
		total += count
	}

	// Get enabled plugins
	enabledRows, err := s.db.Query("SELECT id FROM extensions WHERE enabled = TRUE AND type = 'plugin' ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("failed to query enabled plugins: %w", err)
	}
	defer enabledRows.Close()

	var enabledPlugins []string
	for enabledRows.Next() {
		var id string
		if err := enabledRows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan enabled plugin: %w", err)
		}
		enabledPlugins = append(enabledPlugins, id)
	}

	// Get disabled plugins
	disabledRows, err := s.db.Query("SELECT id FROM extensions WHERE enabled = FALSE AND type = 'plugin' ORDER BY name")
	if err != nil {
		return nil, fmt.Errorf("failed to query disabled plugins: %w", err)
	}
	defer disabledRows.Close()

	var disabledPlugins []string
	for disabledRows.Next() {
		var id string
		if err := disabledRows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan disabled plugin: %w", err)
		}
		disabledPlugins = append(disabledPlugins, id)
	}

	return &model.ExtensionStatsResponse{
		Stats: model.ExtensionStats{
			Total:           total,
			ByType:          byType,
			EnabledPlugins:  enabledPlugins,
			DisabledPlugins: disabledPlugins,
		},
	}, nil
}

// scanExtension is a helper to scan a row into an Extension model
func scanExtension(rows *sql.Rows) (*model.Extension, error) {
	var ext model.Extension
	var metadataJSON, filePath sql.NullString
	var pluginID, marketplaceID, projectPath sql.NullString
	var createdAt, updatedAt sql.NullTime

	err := rows.Scan(
		&ext.ID, &ext.Type, &ext.Name, &ext.Description, &ext.Enabled,
		&ext.Source, &pluginID, &marketplaceID, &filePath, &projectPath,
		&metadataJSON, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan extension: %w", err)
	}

	if metadataJSON.Valid {
		ext.MetadataJSON = json.RawMessage(metadataJSON.String)
	}
	if pluginID.Valid {
		ext.PluginID = &pluginID.String
	}
	if marketplaceID.Valid {
		ext.MarketplaceID = &marketplaceID.String
	}
	if filePath.Valid {
		ext.FilePath = filePath.String
	}
	if projectPath.Valid {
		ext.ProjectPath = &projectPath.String
	}
	if createdAt.Valid {
		ext.CreatedAt = createdAt.Time
	}
	if updatedAt.Valid {
		ext.UpdatedAt = updatedAt.Time
	}

	return &ext, nil
}

// scanExtensionRow is a helper to scan a QueryRow result into an Extension model
func scanExtensionRow(row *sql.Row) (*model.Extension, error) {
	var ext model.Extension
	var metadataJSON, filePath sql.NullString
	var pluginID, marketplaceID, projectPath sql.NullString
	var createdAt, updatedAt sql.NullTime

	err := row.Scan(
		&ext.ID, &ext.Type, &ext.Name, &ext.Description, &ext.Enabled,
		&ext.Source, &pluginID, &marketplaceID, &filePath, &projectPath,
		&metadataJSON, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	if metadataJSON.Valid {
		ext.MetadataJSON = json.RawMessage(metadataJSON.String)
	}
	if pluginID.Valid {
		ext.PluginID = &pluginID.String
	}
	if marketplaceID.Valid {
		ext.MarketplaceID = &marketplaceID.String
	}
	if filePath.Valid {
		ext.FilePath = filePath.String
	}
	if projectPath.Valid {
		ext.ProjectPath = &projectPath.String
	}
	if createdAt.Valid {
		ext.CreatedAt = createdAt.Time
	}
	if updatedAt.Valid {
		ext.UpdatedAt = updatedAt.Time
	}

	return &ext, nil
}

// GetSubagentHierarchy returns the full agent hierarchy for a session
func (s *SQLiteStorageService) GetSubagentHierarchy(sessionID string) (*model.SubagentGraphResponse, error) {
	query := `
		SELECT id, session_id, parent_agent_id, agent_id,
		       first_message_uuid, last_message_uuid, message_count,
		       spawn_time, end_time, status, is_sidechain
		FROM subagent_graph
		WHERE session_id = ?
		ORDER BY spawn_time ASC
	`

	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query subagent graph: %w", err)
	}
	defer rows.Close()

	nodes := make(map[string]*model.SubagentGraphNode)
	var allNodes []*model.SubagentGraphNode

	for rows.Next() {
		var node model.SubagentGraphNode
		var parentAgentID sql.NullString
		var endTime sql.NullString
		var spawnTimeStr, statusStr string

		err := rows.Scan(
			&node.ID, &node.SessionID, &parentAgentID, &node.AgentID,
			&node.FirstMessageUUID, &node.LastMessageUUID, &node.MessageCount,
			&spawnTimeStr, &endTime, &statusStr, &node.IsSidechain,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		if parentAgentID.Valid {
			node.ParentAgentID = &parentAgentID.String
		}
		node.SpawnTime, _ = time.Parse(time.RFC3339, spawnTimeStr)
		if endTime.Valid {
			t, _ := time.Parse(time.RFC3339, endTime.String)
			node.EndTime = &t
		}
		node.Status = statusStr

		nodes[node.AgentID] = &node
		allNodes = append(allNodes, &node)
	}

	if len(allNodes) == 0 {
		return nil, nil // No agents found for session
	}

	// Build hierarchy tree
	hierarchy := buildHierarchy(allNodes)
	maxDepth := calculateMaxDepth(hierarchy)

	return &model.SubagentGraphResponse{
		SessionID:   sessionID,
		Hierarchy:   hierarchy,
		TotalAgents: len(allNodes),
		MaxDepth:    maxDepth,
	}, nil
}

// Helper to build tree from flat list
func buildHierarchy(nodes []*model.SubagentGraphNode) *model.SubagentHierarchy {
	nodeMap := make(map[string]*model.SubagentHierarchy)
	var roots []*model.SubagentHierarchy

	// Create hierarchy nodes
	for _, node := range nodes {
		nodeMap[node.AgentID] = &model.SubagentHierarchy{Node: node}
	}

	// Link parents to children
	for _, node := range nodes {
		h := nodeMap[node.AgentID]
		if node.ParentAgentID == nil {
			roots = append(roots, h)
		} else if parent, ok := nodeMap[*node.ParentAgentID]; ok {
			parent.Children = append(parent.Children, h)
		} else {
			// Parent not found, treat as root
			roots = append(roots, h)
		}
	}

	if len(roots) == 1 {
		return roots[0]
	}
	// Multiple roots - wrap in virtual root
	return &model.SubagentHierarchy{
		Node:     nil,
		Children: roots,
	}
}

func calculateMaxDepth(h *model.SubagentHierarchy) int {
	if h == nil {
		return 0
	}
	maxChildDepth := 0
	for _, child := range h.Children {
		d := calculateMaxDepth(child)
		if d > maxChildDepth {
			maxChildDepth = d
		}
	}
	if h.Node == nil {
		return maxChildDepth // Virtual root doesn't count
	}
	return maxChildDepth + 1
}

// GetSubagentGraphStats returns aggregate metrics
func (s *SQLiteStorageService) GetSubagentGraphStats() (*model.SubagentGraphStats, error) {
	var stats model.SubagentGraphStats

	// Total sessions with agents
	s.db.QueryRow("SELECT COUNT(DISTINCT session_id) FROM subagent_graph").Scan(&stats.TotalSessions)

	// Total agents
	s.db.QueryRow("SELECT COUNT(*) FROM subagent_graph").Scan(&stats.TotalAgents)

	// Root agents (no parent)
	s.db.QueryRow("SELECT COUNT(*) FROM subagent_graph WHERE parent_agent_id IS NULL").Scan(&stats.TotalRootAgents)

	// Sidechain agents
	s.db.QueryRow("SELECT COUNT(*) FROM subagent_graph WHERE is_sidechain = 1").Scan(&stats.TotalSidechains)

	// Average agents per session
	if stats.TotalSessions > 0 {
		stats.AvgAgentsPerSession = float64(stats.TotalAgents) / float64(stats.TotalSessions)
	}

	// [LAW:one-source-of-truth] Derive depth from the graph data, not a hardcoded constant
	s.db.QueryRow(`
		WITH RECURSIVE depth_calc AS (
			SELECT agent_id, 1 AS depth
			FROM subagent_graph WHERE parent_agent_id IS NULL
			UNION ALL
			SELECT sg.agent_id, dc.depth + 1
			FROM subagent_graph sg
			JOIN depth_calc dc ON sg.parent_agent_id = dc.agent_id
		)
		SELECT COALESCE(MAX(depth), 0) FROM depth_calc
	`).Scan(&stats.MaxDepth)

	return &stats, nil
}

// GetSubagentGraphAgent returns a single agent node
func (s *SQLiteStorageService) GetSubagentGraphAgent(sessionID, agentID string) (*model.SubagentGraphNode, error) {
	query := `
		SELECT id, session_id, parent_agent_id, agent_id,
		       first_message_uuid, last_message_uuid, message_count,
		       spawn_time, end_time, status, is_sidechain
		FROM subagent_graph
		WHERE session_id = ? AND agent_id = ?
	`

	var node model.SubagentGraphNode
	var parentAgentID, endTime sql.NullString
	var spawnTimeStr string

	err := s.db.QueryRow(query, sessionID, agentID).Scan(
		&node.ID, &node.SessionID, &parentAgentID, &node.AgentID,
		&node.FirstMessageUUID, &node.LastMessageUUID, &node.MessageCount,
		&spawnTimeStr, &endTime, &node.Status, &node.IsSidechain,
	)

	if err == sql.ErrNoRows {
		return nil, nil // Not found
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query subagent graph agent: %w", err)
	}

	if parentAgentID.Valid {
		node.ParentAgentID = &parentAgentID.String
	}
	node.SpawnTime, _ = time.Parse(time.RFC3339, spawnTimeStr)
	if endTime.Valid {
		t, _ := time.Parse(time.RFC3339, endTime.String)
		node.EndTime = &t
	}

	return &node, nil
}

// GetPlugins returns all installed plugins with component counts from database
func (s *SQLiteStorageService) GetPlugins() ([]model.Plugin, error) {
	// Read installed_plugins.json
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	installedPluginsPath := filepath.Join(homeDir, ".claude", "plugins", "installed_plugins.json")
	data, err := os.ReadFile(installedPluginsPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []model.Plugin{}, nil
		}
		return nil, fmt.Errorf("failed to read installed_plugins.json: %w", err)
	}

	var installedPlugins struct {
		Version int                                 `json:"version"`
		Plugins map[string][]map[string]interface{} `json:"plugins"`
	}

	if err := json.Unmarshal(data, &installedPlugins); err != nil {
		return nil, fmt.Errorf("failed to parse installed_plugins.json: %w", err)
	}

	var plugins []model.Plugin
	for pluginKey, installations := range installedPlugins.Plugins {
		if len(installations) == 0 {
			continue
		}

		// Use the first installation (most recent)
		installation := installations[0]

		// Parse pluginKey as "plugin@marketplace"
		parts := strings.Split(pluginKey, "@")
		if len(parts) != 2 {
			continue
		}
		pluginName := parts[0]
		marketplace := parts[1]

		// Get component counts from database
		counts, err := s.getComponentCounts(pluginKey)
		if err != nil {
			log.Printf("Warning: failed to get component counts for %s: %v", pluginKey, err)
			counts = model.ComponentCounts{}
		}

		plugin := model.Plugin{
			ID:              pluginKey,
			Name:            pluginName,
			Marketplace:     marketplace,
			Version:         getStringField(installation, "version"),
			InstallPath:     getStringField(installation, "installPath"),
			ComponentCounts: counts,
		}

		plugins = append(plugins, plugin)
	}

	return plugins, nil
}

// GetPlugin returns a single plugin by ID
func (s *SQLiteStorageService) GetPlugin(pluginID string) (*model.Plugin, error) {
	plugins, err := s.GetPlugins()
	if err != nil {
		return nil, err
	}

	for _, p := range plugins {
		if p.ID == pluginID {
			return &p, nil
		}
	}

	return nil, fmt.Errorf("plugin not found: %s", pluginID)
}

// GetMarketplaces returns all known marketplaces with plugin counts
func (s *SQLiteStorageService) GetMarketplaces() ([]model.Marketplace, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	knownMarketplacesPath := filepath.Join(homeDir, ".claude", "plugins", "known_marketplaces.json")
	data, err := os.ReadFile(knownMarketplacesPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []model.Marketplace{}, nil
		}
		return nil, fmt.Errorf("failed to read known_marketplaces.json: %w", err)
	}

	var knownMarketplaces map[string]map[string]interface{}
	if err := json.Unmarshal(data, &knownMarketplaces); err != nil {
		return nil, fmt.Errorf("failed to parse known_marketplaces.json: %w", err)
	}

	// Get all plugins to count per marketplace
	plugins, err := s.GetPlugins()
	if err != nil {
		return nil, fmt.Errorf("failed to get plugins: %w", err)
	}

	pluginsByMarketplace := make(map[string][]model.Plugin)
	for _, p := range plugins {
		pluginsByMarketplace[p.Marketplace] = append(pluginsByMarketplace[p.Marketplace], p)
	}

	var marketplaces []model.Marketplace
	for marketplaceID, marketplaceData := range knownMarketplaces {
		sourceType := "unknown"
		sourceURL := ""

		if source, ok := marketplaceData["source"].(map[string]interface{}); ok {
			if st, ok := source["source"].(string); ok {
				sourceType = st
			}
			if url, ok := source["url"].(string); ok {
				sourceURL = url
			}
		}

		marketplace := model.Marketplace{
			ID:          marketplaceID,
			Name:        marketplaceID,
			SourceType:  sourceType,
			SourceURL:   sourceURL,
			LastUpdated: getStringField(marketplaceData, "lastUpdated"),
			AutoUpdate:  getBoolField(marketplaceData, "autoUpdate"),
			PluginCount: len(pluginsByMarketplace[marketplaceID]),
			Plugins:     pluginsByMarketplace[marketplaceID],
		}

		marketplaces = append(marketplaces, marketplace)
	}

	return marketplaces, nil
}

// getComponentCounts queries the database for extension counts by source
func (s *SQLiteStorageService) getComponentCounts(pluginSource string) (model.ComponentCounts, error) {
	query := `SELECT type, COUNT(*) FROM extensions WHERE source = ? GROUP BY type`
	rows, err := s.db.Query(query, pluginSource)
	if err != nil {
		return model.ComponentCounts{}, err
	}
	defer rows.Close()

	counts := model.ComponentCounts{}
	for rows.Next() {
		var extType string
		var count int
		if err := rows.Scan(&extType, &count); err != nil {
			return counts, err
		}

		switch extType {
		case "agent":
			counts.Agents = count
		case "command":
			counts.Commands = count
		case "skill":
			counts.Skills = count
		case "hook":
			counts.Hooks = count
		case "mcp":
			counts.MCP = count
		}
	}

	return counts, nil
}

// Helper functions for JSON field extraction
func getStringField(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

func getBoolField(m map[string]interface{}, key string) bool {
	if val, ok := m[key].(bool); ok {
		return val
	}
	return false
}

// UpsertSessionsForConversation populates the sessions and session_conversation_map
// tables for a single conversation that was just indexed. Called incrementally after
// each conversation file is committed to the database.
func (s *SQLiteStorageService) UpsertSessionsForConversation(conversationID string) error {
	// Upsert into sessions: derive session data from conversation_messages for this conversation.
	_, err := s.db.Exec(`
		INSERT INTO sessions (id, project_path, started_at, ended_at, message_count)
		SELECT
			cm.session_id,
			c.project_path,
			MIN(cm.timestamp),
			MAX(cm.timestamp),
			COUNT(*)
		FROM conversation_messages cm
		JOIN conversations c ON cm.conversation_id = c.id
		WHERE cm.conversation_id = ?
		  AND cm.session_id IS NOT NULL AND cm.session_id != ''
		GROUP BY cm.session_id
		ON CONFLICT(id) DO UPDATE SET
			started_at = MIN(sessions.started_at, excluded.started_at),
			ended_at = MAX(sessions.ended_at, excluded.ended_at),
			message_count = excluded.message_count
	`, conversationID)
	if err != nil {
		return fmt.Errorf("failed to upsert sessions: %w", err)
	}

	// Upsert into session_conversation_map.
	_, err = s.db.Exec(`
		INSERT INTO session_conversation_map
			(session_id, conversation_id, first_message_uuid, last_message_uuid, message_count)
		SELECT
			session_id,
			conversation_id,
			MIN(uuid),
			MAX(uuid),
			COUNT(*)
		FROM conversation_messages
		WHERE conversation_id = ?
		  AND session_id IS NOT NULL AND session_id != ''
		GROUP BY session_id, conversation_id
		ON CONFLICT(session_id, conversation_id) DO UPDATE SET
			first_message_uuid = excluded.first_message_uuid,
			last_message_uuid = excluded.last_message_uuid,
			message_count = excluded.message_count
	`, conversationID)
	if err != nil {
		return fmt.Errorf("failed to upsert session_conversation_map: %w", err)
	}

	// [LAW:single-enforcer] Update aggregate fields (conversation_count, agent_count, todo_count)
	// derived from related tables. This ensures the sessions table has complete metadata.
	_, err = s.db.Exec(`
		UPDATE sessions SET
			conversation_count = (
				SELECT COUNT(*) FROM session_conversation_map
				WHERE session_id = sessions.id
			),
			agent_count = (
				SELECT COUNT(*) FROM subagent_graph
				WHERE session_id = sessions.id
			),
			todo_count = (
				SELECT COUNT(*) FROM claude_todos
				WHERE session_uuid = sessions.id
			)
		WHERE id IN (
			SELECT DISTINCT session_id FROM conversation_messages
			WHERE conversation_id = ? AND session_id IS NOT NULL AND session_id != ''
		)
	`, conversationID)
	if err != nil {
		return fmt.Errorf("failed to update session aggregates: %w", err)
	}

	return nil
}

// ============================================================================
// Session Management
// ============================================================================

// GetSessions returns a paginated list of sessions ordered by started_at descending
func (s *SQLiteStorageService) GetSessions(limit, offset int) ([]*model.Session, error) {
	if s.hybrid != nil && s.hybrid.Canonical != nil {
		return s.hybrid.Canonical.GetSessions(limit, offset)
	}

	query := `
		SELECT sessions.id, sessions.project_path, sessions.started_at, sessions.ended_at,
		       conversation_count, message_count, agent_count, todo_count,
		       COALESCE(created_at, started_at, CURRENT_TIMESTAMP) AS created_at,
		       COALESCE(token_agg.total_tokens, 0) as total_tokens,
		       COALESCE(token_agg.input_tokens, 0) as input_tokens,
		       COALESCE(token_agg.output_tokens, 0) as output_tokens,
		       COALESCE(token_agg.cache_read_tokens, 0) as cache_read_tokens,
		       COALESCE(token_agg.cache_creation_tokens, 0) as cache_creation_tokens
		FROM sessions
		LEFT JOIN (
			SELECT
				session_key,
				SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as total_tokens,
				SUM(input_tokens) as input_tokens,
				SUM(output_tokens) as output_tokens,
				SUM(cache_read_tokens) as cache_read_tokens,
				SUM(cache_creation_tokens) as cache_creation_tokens
			FROM (
				SELECT
					COALESCE(NULLIF(session_id, ''), NULLIF(agent_id, '')) as session_key,
					COALESCE(request_id, uuid) as dedup_key,
					MAX(input_tokens) as input_tokens,
					MAX(output_tokens) as output_tokens,
					MAX(cache_read_tokens) as cache_read_tokens,
					MAX(cache_creation_tokens) as cache_creation_tokens
				FROM conversation_messages
				WHERE role IN ('user', 'assistant')
				  AND COALESCE(NULLIF(session_id, ''), NULLIF(agent_id, '')) IS NOT NULL
				GROUP BY session_key, dedup_key
			)
			GROUP BY session_key
		) token_agg ON token_agg.session_key = sessions.id
		ORDER BY sessions.started_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := s.db.Query(query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*model.Session
	for rows.Next() {
		var session model.Session
		var projectPath, startedAt, endedAt, createdAt sql.NullString

		err := rows.Scan(
			&session.ID,
			&projectPath,
			&startedAt,
			&endedAt,
			&session.ConversationCount,
			&session.MessageCount,
			&session.AgentCount,
			&session.TodoCount,
			&createdAt,
			&session.TotalTokens,
			&session.InputTokens,
			&session.OutputTokens,
			&session.CacheReadTokens,
			&session.CacheWriteTokens,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan session row: %w", err)
		}

		if projectPath.Valid {
			session.ProjectPath = projectPath.String
		}

		if t, ok := parseDBTime(startedAt); ok {
			session.StartedAt = &t
		}

		if t, ok := parseDBTime(endedAt); ok {
			session.EndedAt = &t
		}

		if t, ok := parseDBTime(createdAt); ok {
			session.CreatedAt = t
		}
		session.CacheHitRatePercent = promptCacheHitRatePercent(session.InputTokens, session.CacheReadTokens, session.CacheWriteTokens)

		sessions = append(sessions, &session)
	}

	return sessions, nil
}

// GetSession returns a single session by ID
func (s *SQLiteStorageService) GetSession(sessionID string) (*model.Session, error) {
	if s.hybrid != nil && s.hybrid.Canonical != nil {
		return s.hybrid.Canonical.GetSession(sessionID)
	}

	query := `
		SELECT sessions.id, sessions.project_path, sessions.started_at, sessions.ended_at,
		       conversation_count, message_count, agent_count, todo_count,
		       COALESCE(created_at, started_at, CURRENT_TIMESTAMP) AS created_at,
		       COALESCE(token_agg.total_tokens, 0) as total_tokens,
		       COALESCE(token_agg.input_tokens, 0) as input_tokens,
		       COALESCE(token_agg.output_tokens, 0) as output_tokens,
		       COALESCE(token_agg.cache_read_tokens, 0) as cache_read_tokens,
		       COALESCE(token_agg.cache_creation_tokens, 0) as cache_creation_tokens
		FROM sessions
		LEFT JOIN (
			SELECT
				session_key,
				SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as total_tokens,
				SUM(input_tokens) as input_tokens,
				SUM(output_tokens) as output_tokens,
				SUM(cache_read_tokens) as cache_read_tokens,
				SUM(cache_creation_tokens) as cache_creation_tokens
			FROM (
				SELECT
					COALESCE(NULLIF(session_id, ''), NULLIF(agent_id, '')) as session_key,
					COALESCE(request_id, uuid) as dedup_key,
					MAX(input_tokens) as input_tokens,
					MAX(output_tokens) as output_tokens,
					MAX(cache_read_tokens) as cache_read_tokens,
					MAX(cache_creation_tokens) as cache_creation_tokens
				FROM conversation_messages
				WHERE role IN ('user', 'assistant')
				  AND COALESCE(NULLIF(session_id, ''), NULLIF(agent_id, '')) IS NOT NULL
				GROUP BY session_key, dedup_key
			)
			GROUP BY session_key
		) token_agg ON token_agg.session_key = sessions.id
		WHERE sessions.id = ?
	`

	var session model.Session
	var projectPath, startedAt, endedAt, createdAt sql.NullString

	err := s.db.QueryRow(query, sessionID).Scan(
		&session.ID,
		&projectPath,
		&startedAt,
		&endedAt,
		&session.ConversationCount,
		&session.MessageCount,
		&session.AgentCount,
		&session.TodoCount,
		&createdAt,
		&session.TotalTokens,
		&session.InputTokens,
		&session.OutputTokens,
		&session.CacheReadTokens,
		&session.CacheWriteTokens,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query session: %w", err)
	}

	if projectPath.Valid {
		session.ProjectPath = projectPath.String
	}

	if t, ok := parseDBTime(startedAt); ok {
		session.StartedAt = &t
	}

	if t, ok := parseDBTime(endedAt); ok {
		session.EndedAt = &t
	}

	if t, ok := parseDBTime(createdAt); ok {
		session.CreatedAt = t
	}
	session.CacheHitRatePercent = promptCacheHitRatePercent(session.InputTokens, session.CacheReadTokens, session.CacheWriteTokens)

	return &session, nil
}

// [LAW:one-source-of-truth] Centralize database timestamp parsing so session
// timestamps are interpreted consistently across all read paths.
func parseDBTime(value sql.NullString) (time.Time, bool) {
	if !value.Valid || value.String == "" {
		return time.Time{}, false
	}

	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
	}

	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value.String)
		if err == nil {
			return parsed, true
		}
	}

	return time.Time{}, false
}

// GetSessionStats returns aggregate statistics about all sessions
func (s *SQLiteStorageService) GetSessionStats() (*model.SessionStats, error) {
	query := `
		SELECT
			COUNT(*) as total_sessions,
			SUM(CASE WHEN ended_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) as active_sessions,
			SUM(message_count) as total_messages,
			COUNT(DISTINCT project_path) as unique_projects
		FROM sessions
	`

	var stats model.SessionStats
	var activeSessions, totalMessages, uniqueProjects sql.NullInt64

	err := s.db.QueryRow(query).Scan(
		&stats.TotalSessions,
		&activeSessions,
		&totalMessages,
		&uniqueProjects,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to query session stats: %w", err)
	}

	if activeSessions.Valid {
		stats.ActiveSessions = int(activeSessions.Int64)
	}
	if totalMessages.Valid {
		stats.TotalMessages = int(totalMessages.Int64)
	}
	if uniqueProjects.Valid {
		stats.UniqueProjects = int(uniqueProjects.Int64)
	}

	return &stats, nil
}

// GetSessionConversations returns conversations for a session
func (s *SQLiteStorageService) GetSessionConversations(sessionID string) ([]*model.IndexedConversation, error) {
	linker := NewRelationshipLinker(s)
	return linker.GetSessionConversations(sessionID)
}

// GetConversationSessions returns sessions that included a conversation
func (s *SQLiteStorageService) GetConversationSessions(conversationID string) ([]*model.Session, error) {
	linker := NewRelationshipLinker(s)
	return linker.GetConversationSessions(conversationID)
}

// GetSessionFileChanges returns file changes for a session
func (s *SQLiteStorageService) GetSessionFileChanges(sessionID string) ([]*model.SessionFileChange, error) {
	linker := NewRelationshipLinker(s)
	return linker.GetSessionFileChanges(sessionID)
}

// GetFileChangeSessions returns sessions that modified a file (prefix match)
func (s *SQLiteStorageService) GetFileChangeSessions(filePath string) ([]*model.Session, error) {
	linker := NewRelationshipLinker(s)
	return linker.GetFileChangeSessions(filePath)
}

// SaveFileChange saves a file change to the database
func (s *SQLiteStorageService) SaveFileChange(change *model.SessionFileChange) error {
	linker := NewRelationshipLinker(s)
	return linker.saveFileChange(change)
}

// GetPlanSessions returns sessions linked to a plan
func (s *SQLiteStorageService) GetPlanSessions(planID int) ([]*model.Session, error) {
	query := `
	SELECT s.id, s.project_path, s.started_at, s.ended_at,
	       s.conversation_count, s.message_count, s.agent_count, s.todo_count,
	       s.created_at
	FROM plan_session_map psm
	JOIN sessions s ON psm.session_id = s.id
	WHERE psm.plan_id = ?
	ORDER BY psm.discovered_at DESC
	`

	rows, err := s.db.Query(query, planID)
	if err != nil {
		return nil, fmt.Errorf("failed to query plan sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*model.Session
	for rows.Next() {
		var session model.Session
		var projectPath sql.NullString
		var startedAt, endedAt sql.NullTime

		if err := rows.Scan(
			&session.ID,
			&projectPath,
			&startedAt,
			&endedAt,
			&session.ConversationCount,
			&session.MessageCount,
			&session.AgentCount,
			&session.TodoCount,
			&session.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan session: %w", err)
		}

		if projectPath.Valid {
			session.ProjectPath = projectPath.String
		}
		if startedAt.Valid {
			session.StartedAt = &startedAt.Time
		}
		if endedAt.Valid {
			session.EndedAt = &endedAt.Time
		}

		sessions = append(sessions, &session)
	}

	return sessions, nil
}

// GetSessionPlans returns plans linked to a session
func (s *SQLiteStorageService) GetSessionPlans(sessionID string) ([]*model.Plan, error) {
	query := `
	SELECT p.id, p.file_name, p.display_name, p.content, p.preview,
	       p.file_size, p.modified_at, p.indexed_at, p.session_uuid
	FROM plan_session_map psm
	JOIN claude_plans p ON psm.plan_id = p.id
	WHERE psm.session_id = ?
	ORDER BY psm.discovered_at DESC
	`

	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query session plans: %w", err)
	}
	defer rows.Close()

	var plans []*model.Plan
	for rows.Next() {
		var plan model.Plan
		var sessionUUID sql.NullString

		if err := rows.Scan(
			&plan.ID,
			&plan.FileName,
			&plan.DisplayName,
			&plan.Content,
			&plan.Preview,
			&plan.FileSize,
			&plan.ModifiedAt,
			&plan.IndexedAt,
			&sessionUUID,
		); err != nil {
			return nil, fmt.Errorf("failed to scan plan: %w", err)
		}

		if sessionUUID.Valid {
			plan.SessionUUID = &sessionUUID.String
		}

		plans = append(plans, &plan)
	}

	return plans, nil
}

// LinkPlanToSession creates a relationship between a plan and a session
func (s *SQLiteStorageService) LinkPlanToSession(planID int, sessionID string, relationship string, confidence string) error {
	query := `
	INSERT OR IGNORE INTO plan_session_map
		(plan_id, session_id, relationship, confidence)
	VALUES (?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, planID, sessionID, relationship, confidence)
	if err != nil {
		return fmt.Errorf("failed to link plan to session: %w", err)
	}

	return nil
}

// GetTodosBySession returns todos for a session
func (s *SQLiteStorageService) GetTodosBySession(sessionID string) ([]*model.Todo, error) {
	query := `
	SELECT id, session_uuid, agent_uuid, file_path, content, status,
	       active_form, item_index, modified_at, indexed_at
	FROM claude_todos
	WHERE session_uuid = ?
	ORDER BY item_index
	`

	rows, err := s.db.Query(query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query todos: %w", err)
	}
	defer rows.Close()

	var todos []*model.Todo
	for rows.Next() {
		var todo model.Todo

		if err := rows.Scan(
			&todo.ID,
			&todo.SessionUUID,
			&todo.AgentUUID,
			&todo.FilePath,
			&todo.Content,
			&todo.Status,
			&todo.ActiveForm,
			&todo.ItemIndex,
			&todo.ModifiedAt,
			&todo.IndexedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan todo: %w", err)
		}

		todos = append(todos, &todo)
	}

	return todos, nil
}

// SearchTodos performs full-text search on todos
func (s *SQLiteStorageService) SearchTodos(query, status string, limit, offset int, after, before string) ([]*model.TodoSearchResult, int, error) {
	if strings.TrimSpace(query) == "" {
		return []*model.TodoSearchResult{}, 0, nil
	}

	ftsQuery := buildFTS5Query(query)

	// Get total count
	countQuery := `
		SELECT COUNT(DISTINCT t.id)
		FROM todos_fts f
		JOIN claude_todos t ON f.todo_id = t.id
		WHERE todos_fts MATCH ?
	`
	countArgs := []interface{}{ftsQuery}

	if status != "" {
		countQuery += " AND t.status = ?"
		countArgs = append(countArgs, status)
	}

	dateClause, dateArgs := dateFilterSQL("t.modified_at", after, before)
	countQuery += dateClause
	countArgs = append(countArgs, dateArgs...)

	var total int
	if err := s.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to get total count: %w", err)
	}

	// Build results query - include session_uuid and content for snippet
	resultQuery := `
		SELECT DISTINCT
			t.id,
			t.session_uuid,
			t.content,
			t.status,
			COUNT(f.rowid) as match_count,
			t.modified_at
		FROM todos_fts f
		JOIN claude_todos t ON f.todo_id = t.id
		WHERE todos_fts MATCH ?
	`
	queryArgs := []interface{}{ftsQuery}

	if status != "" {
		resultQuery += " AND t.status = ?"
		queryArgs = append(queryArgs, status)
	}

	dateClause2, dateArgs2 := dateFilterSQL("t.modified_at", after, before)
	resultQuery += dateClause2
	queryArgs = append(queryArgs, dateArgs2...)

	resultQuery += `
		GROUP BY t.id
		ORDER BY match_count DESC, t.modified_at DESC
		LIMIT ? OFFSET ?
	`
	queryArgs = append(queryArgs, limit, offset)

	rows, err := s.db.Query(resultQuery, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query todos: %w", err)
	}
	defer rows.Close()

	var results []*model.TodoSearchResult
	for rows.Next() {
		var result model.TodoSearchResult
		var content sql.NullString
		var modifiedAt sql.NullString

		if err := rows.Scan(
			&result.ID,
			&result.SessionUUID,
			&content,
			&result.Status,
			&result.MatchCount,
			&modifiedAt,
		); err != nil {
			continue
		}

		if modifiedAt.Valid {
			result.ModifiedAt = modifiedAt.String
		}

		// Extract snippet with highlights from content
		if content.Valid && content.String != "" {
			snippet := ExtractSnippet(content.String, query, 100)
			result.Snippet = snippet.Snippet
			result.HighlightStart = snippet.HighlightStart
			result.HighlightEnd = snippet.HighlightEnd
		}

		results = append(results, &result)
	}

	return results, total, nil
}

// GetAllPlans returns all plans (for linking)
func (s *SQLiteStorageService) GetAllPlans() ([]*model.Plan, error) {
	query := `
	SELECT id, file_name, display_name, content, preview,
	       file_size, modified_at, indexed_at, session_uuid
	FROM claude_plans
	ORDER BY modified_at DESC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query plans: %w", err)
	}
	defer rows.Close()

	var plans []*model.Plan
	for rows.Next() {
		var plan model.Plan
		var sessionUUID sql.NullString

		if err := rows.Scan(
			&plan.ID,
			&plan.FileName,
			&plan.DisplayName,
			&plan.Content,
			&plan.Preview,
			&plan.FileSize,
			&plan.ModifiedAt,
			&plan.IndexedAt,
			&sessionUUID,
		); err != nil {
			return nil, fmt.Errorf("failed to scan plan: %w", err)
		}

		if sessionUUID.Valid {
			plan.SessionUUID = &sessionUUID.String
		}

		plans = append(plans, &plan)
	}

	return plans, nil
}

// SearchPlans performs full-text search on plans
func (s *SQLiteStorageService) SearchPlans(query, status string, limit, offset int, after, before string) ([]*model.PlanSearchResult, int, error) {
	if strings.TrimSpace(query) == "" {
		return []*model.PlanSearchResult{}, 0, nil
	}

	ftsQuery := buildFTS5Query(query)

	// Get total count
	countQuery := `
		SELECT COUNT(DISTINCT p.id)
		FROM plans_fts f
		JOIN claude_plans p ON f.plan_id = p.id
		WHERE plans_fts MATCH ?
	`
	countArgs := []interface{}{ftsQuery}

	if status != "" {
		countQuery += " AND p.status = ?"
		countArgs = append(countArgs, status)
	}

	dateClause, dateArgs := dateFilterSQL("p.modified_at", after, before)
	countQuery += dateClause
	countArgs = append(countArgs, dateArgs...)

	var total int
	if err := s.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to get total count: %w", err)
	}

	// Build results query - include session_uuid, preview, and content for snippet
	resultQuery := `
		SELECT DISTINCT
			p.id,
			p.file_name,
			p.display_name,
			p.preview,
			p.content,
			p.session_uuid,
			COUNT(f.rowid) as match_count,
			p.modified_at
		FROM plans_fts f
		JOIN claude_plans p ON f.plan_id = p.id
		WHERE plans_fts MATCH ?
	`
	queryArgs := []interface{}{ftsQuery}

	if status != "" {
		resultQuery += " AND p.status = ?"
		queryArgs = append(queryArgs, status)
	}

	dateClause2, dateArgs2 := dateFilterSQL("p.modified_at", after, before)
	resultQuery += dateClause2
	queryArgs = append(queryArgs, dateArgs2...)

	resultQuery += `
		GROUP BY p.id
		ORDER BY match_count DESC, p.modified_at DESC
		LIMIT ? OFFSET ?
	`
	queryArgs = append(queryArgs, limit, offset)

	rows, err := s.db.Query(resultQuery, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query plans: %w", err)
	}
	defer rows.Close()

	var results []*model.PlanSearchResult
	for rows.Next() {
		var result model.PlanSearchResult
		var preview sql.NullString
		var content sql.NullString
		var sessionUUID sql.NullString
		var modifiedAt sql.NullString

		if err := rows.Scan(
			&result.ID,
			&result.FileName,
			&result.DisplayName,
			&preview,
			&content,
			&sessionUUID,
			&result.MatchCount,
			&modifiedAt,
		); err != nil {
			continue
		}

		if modifiedAt.Valid {
			result.ModifiedAt = modifiedAt.String
		}

		// Set session UUID if available
		if sessionUUID.Valid {
			result.SessionUUID = &sessionUUID.String
		}

		// Extract snippet with highlights - prefer content over preview
		textForSnippet := ""
		if content.Valid && content.String != "" {
			textForSnippet = content.String
		} else if preview.Valid && preview.String != "" {
			textForSnippet = preview.String
		}

		if textForSnippet != "" {
			snippet := ExtractSnippet(textForSnippet, query, 100)
			result.Snippet = snippet.Snippet
			result.HighlightStart = snippet.HighlightStart
			result.HighlightEnd = snippet.HighlightEnd
		}

		results = append(results, &result)
	}

	return results, total, nil
}

// GetAllSessionIDs returns all session IDs (for UUID validation)
func (s *SQLiteStorageService) GetAllSessionIDs() ([]string, error) {
	query := "SELECT id FROM sessions"

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query session IDs: %w", err)
	}
	defer rows.Close()

	var sessionIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan session ID: %w", err)
		}
		sessionIDs = append(sessionIDs, id)
	}

	return sessionIDs, nil
}

// GetConversationTokenSummary returns aggregated token statistics for a conversation
func (s *SQLiteStorageService) GetConversationTokenSummary(conversationID string) (*model.ConversationTokenSummary, error) {
	// Deduplicate by request_id before aggregating (see GetStats comment)
	query := `
		SELECT
			COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens), 0) as total_tokens,
			COALESCE(SUM(input_tokens), 0) as input_tokens,
			COALESCE(SUM(output_tokens), 0) as output_tokens,
			COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
			COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
			COALESCE(SUM(cache_creation_5m_tokens), 0) as cache_creation_5m_tokens,
			COALESCE(SUM(cache_creation_1h_tokens), 0) as cache_creation_1h_tokens,
			COUNT(*) as message_count,
			COALESCE(model, 'unknown') as model
		FROM (
			SELECT
				COALESCE(request_id, uuid) as dedup_key,
				MAX(model) as model,
				MAX(input_tokens) as input_tokens,
				MAX(output_tokens) as output_tokens,
				MAX(cache_read_tokens) as cache_read_tokens,
				MAX(cache_creation_tokens) as cache_creation_tokens,
				MAX(cache_creation_5m_tokens) as cache_creation_5m_tokens,
				MAX(cache_creation_1h_tokens) as cache_creation_1h_tokens
			FROM conversation_messages
			WHERE conversation_id = ?
				AND role IN ('user', 'assistant')
			GROUP BY dedup_key
		)
		GROUP BY model
		ORDER BY total_tokens DESC
	`

	rows, err := s.db.Query(query, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to query token summary: %w", err)
	}
	defer rows.Close()

	summary := &model.ConversationTokenSummary{
		ByModel: make(map[string]*model.TokenBreakdown),
	}

	var totalTokens, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens int64
	var cacheCreation5mTokens, cacheCreation1hTokens int64
	var messageCount int64

	for rows.Next() {
		var breakdown model.TokenBreakdown
		if err := rows.Scan(
			&breakdown.TotalTokens,
			&breakdown.InputTokens,
			&breakdown.OutputTokens,
			&breakdown.CacheReadTokens,
			&breakdown.CacheCreationTokens,
			&breakdown.CacheCreation5mTokens,
			&breakdown.CacheCreation1hTokens,
			&breakdown.MessageCount,
			&breakdown.Model,
		); err != nil {
			return nil, fmt.Errorf("failed to scan token breakdown: %w", err)
		}

		summary.ByModel[breakdown.Model] = &breakdown

		totalTokens += breakdown.TotalTokens
		inputTokens += breakdown.InputTokens
		outputTokens += breakdown.OutputTokens
		cacheReadTokens += breakdown.CacheReadTokens
		cacheCreationTokens += breakdown.CacheCreationTokens
		cacheCreation5mTokens += breakdown.CacheCreation5mTokens
		cacheCreation1hTokens += breakdown.CacheCreation1hTokens
		messageCount += breakdown.MessageCount
	}

	// Handle case where conversation has no messages
	if messageCount == 0 {
		summary.ByModel = make(map[string]*model.TokenBreakdown)
	} else if len(summary.ByModel) == 0 {
		// Single model with unknown
		summary.ByModel["unknown"] = &model.TokenBreakdown{
			Model:                 "unknown",
			TotalTokens:           0,
			InputTokens:           0,
			OutputTokens:          0,
			CacheReadTokens:       0,
			CacheCreationTokens:   0,
			CacheCreation5mTokens: 0,
			CacheCreation1hTokens: 0,
			MessageCount:          0,
		}
	}

	summary.TotalTokens = totalTokens
	summary.InputTokens = inputTokens
	summary.OutputTokens = outputTokens
	summary.CacheReadTokens = cacheReadTokens
	summary.CacheCreationTokens = cacheCreationTokens
	summary.CacheCreation5mTokens = cacheCreation5mTokens
	summary.CacheCreation1hTokens = cacheCreation1hTokens
	summary.MessageCount = messageCount
	if messageCount > 0 {
		summary.AvgTokensPerMessage = totalTokens / messageCount
	}
	summary.CacheHitRatePercent = promptCacheHitRatePercent(inputTokens, cacheReadTokens, cacheCreationTokens)

	return summary, nil
}

// GetProjectTokenStats returns token statistics aggregated by project
func (s *SQLiteStorageService) GetProjectTokenStats(startTime, endTime string) ([]*model.ProjectTokenStat, error) {
	// Default to last 30 days if not specified
	if startTime == "" || endTime == "" {
		now := time.Now()
		endTime = now.Format(time.RFC3339)
		startTime = now.AddDate(0, 0, -30).Format(time.RFC3339)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Query project-level stats from message timestamps so the timestamp index can be used.
	query := `
		WITH dedup AS (
			SELECT
				conversation_id,
				MAX(input_tokens) as input_tokens,
				MAX(output_tokens) as output_tokens,
				MAX(cache_read_tokens) as cache_read_tokens,
				MAX(cache_creation_tokens) as cache_creation_tokens,
				MAX(cache_creation_5m_tokens) as cache_creation_5m_tokens,
				MAX(cache_creation_1h_tokens) as cache_creation_1h_tokens
			FROM conversation_messages
			WHERE timestamp BETWEEN ? AND ?
				AND role IN ('user', 'assistant')
			GROUP BY conversation_id, COALESCE(request_id, uuid)
		)
		SELECT
			c.project_name,
			COUNT(DISTINCT d.conversation_id) as conversation_count,
			COALESCE(SUM(d.input_tokens + d.output_tokens + d.cache_read_tokens + d.cache_creation_tokens), 0) as total_tokens,
			COALESCE(SUM(d.input_tokens), 0) as input_tokens,
			COALESCE(SUM(d.output_tokens), 0) as output_tokens,
			COALESCE(SUM(d.cache_read_tokens), 0) as cache_read_tokens,
			COALESCE(SUM(d.cache_creation_tokens), 0) as cache_creation_tokens,
			COALESCE(SUM(d.cache_creation_5m_tokens), 0) as cache_creation_5m_tokens,
			COALESCE(SUM(d.cache_creation_1h_tokens), 0) as cache_creation_1h_tokens
		FROM dedup d
		JOIN conversations c ON d.conversation_id = c.id
		GROUP BY c.project_name
		ORDER BY total_tokens DESC
		LIMIT 25
	`

	rows, err := s.db.QueryContext(ctx, query, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to query project token stats: %w", err)
	}
	defer rows.Close()

	var stats []*model.ProjectTokenStat
	for rows.Next() {
		var stat model.ProjectTokenStat
		if err := rows.Scan(
			&stat.Name,
			&stat.ConversationCount,
			&stat.TotalTokens,
			&stat.InputTokens,
			&stat.OutputTokens,
			&stat.CacheReadTokens,
			&stat.CacheCreationTokens,
			&stat.CacheCreation5mTokens,
			&stat.CacheCreation1hTokens,
		); err != nil {
			return nil, fmt.Errorf("failed to scan project stat: %w", err)
		}
		stat.CacheHitRatePercent = promptCacheHitRatePercent(stat.InputTokens, stat.CacheReadTokens, stat.CacheCreationTokens)

		topRows, err := s.db.QueryContext(ctx, `
			WITH dedup AS (
				SELECT
					conversation_id,
					MAX(input_tokens) as input_tokens,
					MAX(output_tokens) as output_tokens,
					MAX(cache_read_tokens) as cache_read_tokens,
					MAX(cache_creation_tokens) as cache_creation_tokens
				FROM conversation_messages
				WHERE timestamp BETWEEN ? AND ?
					AND role IN ('user', 'assistant')
				GROUP BY conversation_id, COALESCE(request_id, uuid)
			)
			SELECT
				c.id as conversation_id,
				COALESCE(SUM(d.input_tokens + d.output_tokens + d.cache_read_tokens + d.cache_creation_tokens), 0) as total_tokens,
				COALESCE(SUM(d.input_tokens), 0) as input_tokens,
				COALESCE(SUM(d.output_tokens), 0) as output_tokens,
				COALESCE(SUM(d.cache_read_tokens), 0) as cache_read_tokens,
				COALESCE(SUM(d.cache_creation_tokens), 0) as cache_creation_tokens,
				COUNT(*) as message_count
			FROM dedup d
			JOIN conversations c ON d.conversation_id = c.id
			WHERE c.project_name = ?
			GROUP BY c.id
			ORDER BY total_tokens DESC
			LIMIT 5
		`, startTime, endTime, stat.Name)
		if err != nil {
			return nil, fmt.Errorf("failed to query top conversations for project %s: %w", stat.Name, err)
		}

		top := make([]model.ConversationTokenBreakdown, 0, 5)
		for topRows.Next() {
			var row model.ConversationTokenBreakdown
			if err := topRows.Scan(
				&row.ConversationID,
				&row.TotalTokens,
				&row.InputTokens,
				&row.OutputTokens,
				&row.CacheReadTokens,
				&row.CacheCreationTokens,
				&row.MessageCount,
			); err != nil {
				_ = topRows.Close()
				return nil, fmt.Errorf("failed to scan top conversation row for project %s: %w", stat.Name, err)
			}
			row.CacheHitRatePercent = promptCacheHitRatePercent(row.InputTokens, row.CacheReadTokens, row.CacheCreationTokens)
			top = append(top, row)
		}
		if err := topRows.Err(); err != nil {
			_ = topRows.Close()
			return nil, fmt.Errorf("failed iterating top conversation rows for project %s: %w", stat.Name, err)
		}
		if err := topRows.Close(); err != nil {
			return nil, fmt.Errorf("failed closing top conversation rows for project %s: %w", stat.Name, err)
		}
		stat.TopConversations = top

		stats = append(stats, &stat)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed iterating project token stats: %w", err)
	}

	return stats, nil
}

// GetIndexedConversationsWithTokens returns conversations with token aggregation
func (s *SQLiteStorageService) GetIndexedConversationsWithTokens(limit int) ([]*model.IndexedConversationWithTokens, error) {
	// Deduplicate by request_id before aggregating (see GetStats comment)
	query := `
		SELECT
			c.id,
			c.project_path,
			c.project_name,
			c.start_time,
			c.end_time,
			COALESCE(deduped.message_count, 0) as message_count,
			COALESCE(deduped.total_tokens, 0) as total_tokens,
			COALESCE(deduped.input_tokens, 0) as input_tokens,
			COALESCE(deduped.output_tokens, 0) as output_tokens,
			COALESCE(deduped.cache_read_tokens, 0) as cache_read_tokens,
			COALESCE(deduped.cache_creation_tokens, 0) as cache_creation_tokens,
			COALESCE(deduped.cache_creation_5m_tokens, 0) as cache_creation_5m_tokens,
			COALESCE(deduped.cache_creation_1h_tokens, 0) as cache_creation_1h_tokens
		FROM conversations c
		LEFT JOIN (
			SELECT
				conversation_id,
				COUNT(*) as message_count,
				SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens) as total_tokens,
				SUM(input_tokens) as input_tokens,
				SUM(output_tokens) as output_tokens,
				SUM(cache_read_tokens) as cache_read_tokens,
				SUM(cache_creation_tokens) as cache_creation_tokens,
				SUM(cache_creation_5m_tokens) as cache_creation_5m_tokens,
				SUM(cache_creation_1h_tokens) as cache_creation_1h_tokens
			FROM (
				SELECT
					COALESCE(request_id, uuid) as dedup_key,
					conversation_id,
					MAX(input_tokens) as input_tokens,
					MAX(output_tokens) as output_tokens,
					MAX(cache_read_tokens) as cache_read_tokens,
					MAX(cache_creation_tokens) as cache_creation_tokens,
					MAX(cache_creation_5m_tokens) as cache_creation_5m_tokens,
					MAX(cache_creation_1h_tokens) as cache_creation_1h_tokens
				FROM conversation_messages
				WHERE role IN ('user', 'assistant')
				GROUP BY conversation_id, dedup_key
			)
			GROUP BY conversation_id
		) deduped ON c.id = deduped.conversation_id
		GROUP BY c.id
		ORDER BY c.end_time DESC
	`

	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}

	log.Printf("GetIndexedConversationsWithTokens: limit=%d", limit)

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query indexed conversations with tokens: %w", err)
	}
	defer rows.Close()

	var conversations []*model.IndexedConversationWithTokens
	for rows.Next() {
		var conv model.IndexedConversationWithTokens
		var startTime, endTime sql.NullString

		if err := rows.Scan(
			&conv.ID,
			&conv.ProjectPath,
			&conv.ProjectName,
			&startTime,
			&endTime,
			&conv.MessageCount,
			&conv.TotalTokens,
			&conv.InputTokens,
			&conv.OutputTokens,
			&conv.CacheReadTokens,
			&conv.CacheCreationTokens,
			&conv.CacheCreation5mTokens,
			&conv.CacheCreation1hTokens,
		); err != nil {
			continue
		}

		if startTime.Valid {
			if t, err := time.Parse(time.RFC3339, startTime.String); err == nil {
				conv.StartTime = t
			}
		}
		if endTime.Valid {
			if t, err := time.Parse(time.RFC3339, endTime.String); err == nil {
				conv.EndTime = t
			}
		}
		conv.CacheHitRatePercent = promptCacheHitRatePercent(conv.InputTokens, conv.CacheReadTokens, conv.CacheCreationTokens)

		conversations = append(conversations, &conv)
	}

	return conversations, nil
}
