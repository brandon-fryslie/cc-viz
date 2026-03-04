package canonical

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/brandon-fryslie/cc-viz/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Store struct {
	db *gorm.DB
}

func NewWithSQLDB(sqlDB *sql.DB) (*Store, error) {
	db, err := gorm.Open(sqlite.Dialector{Conn: sqlDB}, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, fmt.Errorf("open canonical gorm db: %w", err)
	}

	if err := applyPragmas(db); err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func applyPragmas(db *gorm.DB) error {
	// [LAW:single-enforcer] SQLite durability/concurrency policy is applied once at the DB boundary.
	pragmas := []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA synchronous = NORMAL",
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 30000",
	}
	for _, pragma := range pragmas {
		if err := db.Exec(pragma).Error; err != nil {
			return fmt.Errorf("apply pragma %q: %w", pragma, err)
		}
	}
	return nil
}

func (s *Store) Migrate() error {
	// [LAW:single-enforcer] Canonical schema validation happens once at startup.
	required := map[string][]string{
		"conversations":         {"id", "project_path", "project_name", "start_time", "end_time", "message_count", "file_path"},
		"conversation_messages": {"uuid", "conversation_id", "timestamp", "type", "content_json", "tool_use_json"},
		"sessions":              {"id", "project_path", "started_at", "ended_at", "conversation_count", "message_count", "agent_count", "todo_count"},
	}

	for tableName, columns := range required {
		if err := s.ensureTableColumns(tableName, columns); err != nil {
			return err
		}
	}

	return nil
}

func (s *Store) ensureTableColumns(tableName string, requiredColumns []string) error {
	if !s.db.Migrator().HasTable(tableName) {
		return fmt.Errorf("required canonical table %q is missing", tableName)
	}

	rows, err := s.db.Raw("PRAGMA table_info(" + tableName + ")").Rows()
	if err != nil {
		return fmt.Errorf("inspect %s schema: %w", tableName, err)
	}
	defer rows.Close()

	found := make(map[string]struct{}, len(requiredColumns))
	for rows.Next() {
		var cid int
		var name, colType string
		var notNull, pk int
		var defaultValue interface{}
		if err := rows.Scan(&cid, &name, &colType, &notNull, &defaultValue, &pk); err != nil {
			return fmt.Errorf("scan %s schema: %w", tableName, err)
		}
		found[strings.ToLower(name)] = struct{}{}
	}

	for _, column := range requiredColumns {
		if _, ok := found[strings.ToLower(column)]; !ok {
			return fmt.Errorf("required column %q missing from %s", column, tableName)
		}
	}

	return nil
}

func (s *Store) GetIndexedConversations(limit int) ([]*model.IndexedConversation, error) {
	if limit <= 0 {
		limit = 100
	}

	rows, err := s.db.Raw(`
		SELECT id, project_path, project_name, start_time, end_time, message_count
		FROM conversations
		ORDER BY end_time DESC
		LIMIT ?
	`, limit).Rows()
	if err != nil {
		return nil, fmt.Errorf("query indexed conversations: %w", err)
	}
	defer rows.Close()

	results := make([]*model.IndexedConversation, 0, limit)
	for rows.Next() {
		var conv model.IndexedConversation
		var projectPath, projectName sql.NullString
		var startTime, endTime sql.NullTime
		if err := rows.Scan(
			&conv.ID,
			&projectPath,
			&projectName,
			&startTime,
			&endTime,
			&conv.MessageCount,
		); err != nil {
			return nil, fmt.Errorf("scan indexed conversation: %w", err)
		}

		if projectPath.Valid {
			conv.ProjectPath = projectPath.String
		}
		if projectName.Valid {
			conv.ProjectName = projectName.String
		}
		if startTime.Valid {
			conv.StartTime = startTime.Time
		}
		if endTime.Valid {
			conv.EndTime = endTime.Time
		}

		results = append(results, &conv)
	}

	return results, nil
}

func (s *Store) GetSessions(limit, offset int) ([]*model.Session, error) {
	if limit <= 0 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := s.db.Raw(`
		SELECT id, project_path, started_at, ended_at,
		       conversation_count, message_count, agent_count, todo_count,
		       COALESCE(created_at, started_at, CURRENT_TIMESTAMP) AS created_at
		FROM sessions
		ORDER BY started_at DESC
		LIMIT ? OFFSET ?
	`, limit, offset).Rows()
	if err != nil {
		return nil, fmt.Errorf("query sessions: %w", err)
	}
	defer rows.Close()

	out := make([]*model.Session, 0, limit)
	for rows.Next() {
		session, err := scanSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, session)
	}

	return out, nil
}

func (s *Store) GetSession(sessionID string) (*model.Session, error) {
	rows, err := s.db.Raw(`
		SELECT id, project_path, started_at, ended_at,
		       conversation_count, message_count, agent_count, todo_count,
		       COALESCE(created_at, started_at, CURRENT_TIMESTAMP) AS created_at
		FROM sessions
		WHERE id = ?
	`, sessionID).Rows()
	if err != nil {
		return nil, fmt.Errorf("query session: %w", err)
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, nil
	}

	return scanSession(rows)
}

func scanSession(rows *sql.Rows) (*model.Session, error) {
	var session model.Session
	var projectPath, startedAt, endedAt, createdAt sql.NullString

	if err := rows.Scan(
		&session.ID,
		&projectPath,
		&startedAt,
		&endedAt,
		&session.ConversationCount,
		&session.MessageCount,
		&session.AgentCount,
		&session.TodoCount,
		&createdAt,
	); err != nil {
		return nil, fmt.Errorf("scan session row: %w", err)
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

	return &session, nil
}

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
		if parsed, err := time.Parse(layout, value.String); err == nil {
			return parsed, true
		}
	}

	return time.Time{}, false
}
