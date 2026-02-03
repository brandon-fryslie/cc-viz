package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/brandon-fryslie/cc-viz/internal/model"
)

// RelationshipLinker extracts file changes from tool_use content in conversation messages
type RelationshipLinker struct {
	storage *SQLiteStorageService
}

// NewRelationshipLinker creates a new RelationshipLinker
func NewRelationshipLinker(storage *SQLiteStorageService) *RelationshipLinker {
	return &RelationshipLinker{storage: storage}
}

// messageResponse represents the Anthropic API response structure
type messageResponse struct {
	Content []contentBlock `json:"content"`
}

// contentBlock represents a content block in the response
type contentBlock struct {
	Type  string          `json:"type"`
	ID    string          `json:"id,omitempty"`
	Name  string          `json:"name,omitempty"`
	Input json.RawMessage `json:"input,omitempty"`
}

// writeInput represents Write tool input
type writeInput struct {
	FilePath string `json:"file_path"`
	Content  string `json:"content"`
}

// editInput represents Edit tool input
type editInput struct {
	FilePath  string `json:"file_path"`
	OldString string `json:"old_string"`
	NewString string `json:"new_string"`
}

// bashInput represents Bash tool input
type bashInput struct {
	Command     string `json:"command"`
	Description string `json:"description"`
}

// Bash file operation patterns
var bashFilePattern = regexp.MustCompile(`(?:>\s*|>>\s*|cat\s*>\s*|echo\s+[^>]*>\s*|touch\s+)["']?([^\s"'|;&>]+)`)

// ExtractAndSaveFileChanges extracts file changes from conversation messages and saves them
func (rl *RelationshipLinker) ExtractAndSaveFileChanges() (int, error) {
	// Query messages with tool_use content and session_id
	query := `
	SELECT uuid, session_id, conversation_id, content_json, timestamp
	FROM conversation_messages
	WHERE session_id IS NOT NULL AND session_id != ''
	  AND content_json LIKE '%"tool_use"%'
	ORDER BY timestamp
	`

	rows, err := rl.storage.db.Query(query)
	if err != nil {
		return 0, fmt.Errorf("failed to query tool_use messages: %w", err)
	}
	defer rows.Close()

	changeCount := 0
	for rows.Next() {
		var uuid, sessionID, conversationID, contentJSON string
		var timestamp time.Time

		if err := rows.Scan(&uuid, &sessionID, &conversationID, &contentJSON, &timestamp); err != nil {
			log.Printf("Warning: failed to scan message row: %v", err)
			continue
		}

		// Extract file changes from this message
		changes := rl.extractFileChangesFromContent(contentJSON)
		for _, change := range changes {
			change.SessionID = sessionID
			change.MessageUUID = uuid
			change.Timestamp = &timestamp

			// Save file change
			if err := rl.saveFileChange(change); err != nil {
				log.Printf("Warning: failed to save file change for %s: %v", change.FilePath, err)
				continue
			}
			changeCount++
		}
	}

	if err := rows.Err(); err != nil {
		return changeCount, fmt.Errorf("error iterating messages: %w", err)
	}

	return changeCount, nil
}

// extractFileChangesFromContent parses Anthropic API response and extracts file paths from tool_use blocks
func (rl *RelationshipLinker) extractFileChangesFromContent(contentJSON string) []*model.SessionFileChange {
	var changes []*model.SessionFileChange

	// Try to parse as Anthropic API response
	var msg messageResponse
	if err := json.Unmarshal([]byte(contentJSON), &msg); err != nil {
		return nil
	}

	// Iterate through content blocks looking for tool_use
	for _, block := range msg.Content {
		if block.Type != "tool_use" || block.Name == "" {
			continue
		}

		switch block.Name {
		case "Write":
			var input writeInput
			if json.Unmarshal(block.Input, &input) == nil && input.FilePath != "" {
				changes = append(changes, &model.SessionFileChange{
					FilePath:   input.FilePath,
					ChangeType: "write",
					ToolName:   "Write",
				})
			}

		case "Edit":
			var input editInput
			if json.Unmarshal(block.Input, &input) == nil && input.FilePath != "" {
				changes = append(changes, &model.SessionFileChange{
					FilePath:   input.FilePath,
					ChangeType: "edit",
					ToolName:   "Edit",
				})
			}

		case "Bash":
			var input bashInput
			if json.Unmarshal(block.Input, &input) == nil {
				matches := bashFilePattern.FindAllStringSubmatch(input.Command, -1)
				for _, match := range matches {
					if len(match) > 1 && match[1] != "" && !strings.HasPrefix(match[1], "-") {
						changes = append(changes, &model.SessionFileChange{
							FilePath:   match[1],
							ChangeType: "bash",
							ToolName:   "Bash",
						})
					}
				}
			}
		}
	}

	return changes
}

// saveFileChange saves a file change to the database
func (rl *RelationshipLinker) saveFileChange(change *model.SessionFileChange) error {
	query := `
	INSERT INTO session_file_changes
		(session_id, file_path, change_type, tool_name, message_uuid, timestamp)
	VALUES (?, ?, ?, ?, ?, ?)
	ON CONFLICT DO NOTHING
	`

	_, err := rl.storage.db.Exec(
		query,
		change.SessionID,
		change.FilePath,
		change.ChangeType,
		change.ToolName,
		change.MessageUUID,
		change.Timestamp,
	)

	if err != nil {
		return fmt.Errorf("failed to insert file change: %w", err)
	}

	return nil
}

// GetFileChangeCount returns the total number of file changes tracked
func (rl *RelationshipLinker) GetFileChangeCount() (int, error) {
	var count int
	err := rl.storage.db.QueryRow("SELECT COUNT(*) FROM session_file_changes").Scan(&count)
	return count, err
}

// GetSessionConversations returns conversations for a session
func (rl *RelationshipLinker) GetSessionConversations(sessionID string) ([]*model.IndexedConversation, error) {
	query := `
	SELECT c.id, c.project_path, c.project_name, c.start_time, c.end_time,
	       scm.message_count
	FROM session_conversation_map scm
	JOIN conversations c ON scm.conversation_id = c.id
	WHERE scm.session_id = ?
	ORDER BY scm.message_count DESC
	`

	rows, err := rl.storage.db.Query(query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query session conversations: %w", err)
	}
	defer rows.Close()

	var conversations []*model.IndexedConversation
	for rows.Next() {
		var conv model.IndexedConversation
		var startTime, endTime sql.NullTime

		if err := rows.Scan(
			&conv.ID,
			&conv.ProjectPath,
			&conv.ProjectName,
			&startTime,
			&endTime,
			&conv.MessageCount,
		); err != nil {
			return nil, fmt.Errorf("failed to scan conversation: %w", err)
		}

		if startTime.Valid {
			conv.StartTime = startTime.Time
		}
		if endTime.Valid {
			conv.EndTime = endTime.Time
		}

		conversations = append(conversations, &conv)
	}

	return conversations, nil
}

// GetConversationSessions returns sessions that included a conversation
func (rl *RelationshipLinker) GetConversationSessions(conversationID string) ([]*model.Session, error) {
	query := `
	SELECT s.id, s.project_path, s.started_at, s.ended_at,
	       s.conversation_count, s.message_count, s.agent_count, s.todo_count,
	       s.created_at
	FROM session_conversation_map scm
	JOIN sessions s ON scm.session_id = s.id
	WHERE scm.conversation_id = ?
	ORDER BY s.started_at DESC
	`

	rows, err := rl.storage.db.Query(query, conversationID)
	if err != nil {
		return nil, fmt.Errorf("failed to query conversation sessions: %w", err)
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

// GetSessionFileChanges returns file changes for a session
func (rl *RelationshipLinker) GetSessionFileChanges(sessionID string) ([]*model.SessionFileChange, error) {
	query := `
	SELECT id, session_id, file_path, change_type, tool_name,
	       message_uuid, timestamp, created_at
	FROM session_file_changes
	WHERE session_id = ?
	ORDER BY timestamp DESC
	`

	rows, err := rl.storage.db.Query(query, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query session file changes: %w", err)
	}
	defer rows.Close()

	var changes []*model.SessionFileChange
	for rows.Next() {
		var change model.SessionFileChange
		var timestamp sql.NullTime

		if err := rows.Scan(
			&change.ID,
			&change.SessionID,
			&change.FilePath,
			&change.ChangeType,
			&change.ToolName,
			&change.MessageUUID,
			&timestamp,
			&change.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan file change: %w", err)
		}

		if timestamp.Valid {
			change.Timestamp = &timestamp.Time
		}

		changes = append(changes, &change)
	}

	return changes, nil
}

// GetFileChangeSessions returns sessions that modified a file (prefix match)
func (rl *RelationshipLinker) GetFileChangeSessions(filePath string) ([]*model.Session, error) {
	query := `
	SELECT DISTINCT s.id, s.project_path, s.started_at, s.ended_at,
	       s.conversation_count, s.message_count, s.agent_count, s.todo_count,
	       s.created_at
	FROM session_file_changes sfc
	JOIN sessions s ON sfc.session_id = s.id
	WHERE sfc.file_path LIKE ? || '%'
	ORDER BY s.started_at DESC
	`

	rows, err := rl.storage.db.Query(query, filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to query file sessions: %w", err)
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

// ExtractSessionUUIDsFromPlan extracts session UUIDs from plan content
func (rl *RelationshipLinker) ExtractSessionUUIDsFromPlan(content string) []string {
	// UUID pattern: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
	uuidPattern := regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)
	
	matches := uuidPattern.FindAllString(content, -1)
	
	// Deduplicate
	seen := make(map[string]bool)
	var unique []string
	for _, m := range matches {
		if !seen[m] {
			seen[m] = true
			unique = append(unique, m)
		}
	}
	
	return unique
}

// LinkPlansToSessions links plans to sessions using session_file_changes data
// Plans are created via Write tool calls to ~/.claude/plans/, which we already track
func (rl *RelationshipLinker) LinkPlansToSessions(plansDir string) (int, error) {
	// Query session_file_changes for plan file writes
	// This gives us direct evidence of which session created/modified each plan
	query := `
	SELECT DISTINCT
		p.id as plan_id,
		sfc.session_id,
		MIN(sfc.timestamp) as first_write
	FROM claude_plans p
	JOIN session_file_changes sfc ON sfc.file_path LIKE '%/.claude/plans/' || p.file_name
	GROUP BY p.id, sfc.session_id
	ORDER BY p.id, first_write
	`

	rows, err := rl.storage.db.Query(query)
	if err != nil {
		return 0, fmt.Errorf("failed to query plan-session relationships: %w", err)
	}
	defer rows.Close()

	linkCount := 0
	planLinked := make(map[int]bool) // Track which plans got at least one link

	for rows.Next() {
		var planID int
		var sessionID string
		var firstWriteStr string

		if err := rows.Scan(&planID, &sessionID, &firstWriteStr); err != nil {
			log.Printf("Warning: failed to scan plan-session row: %v", err)
			continue
		}

		// Determine relationship type: first write is "created", subsequent are "modified"
		relationship := "modified"
		if !planLinked[planID] {
			relationship = "created"
			planLinked[planID] = true
		}

		// Link plan to session with high confidence (we have file change evidence)
		err = rl.storage.LinkPlanToSession(planID, sessionID, relationship, "high")
		if err == nil {
			linkCount++
		} else {
			log.Printf("Warning: failed to link plan %d to session %s: %v", planID, sessionID, err)
		}
	}

	if err := rows.Err(); err != nil {
		return linkCount, fmt.Errorf("error iterating plan-session rows: %w", err)
	}

	log.Printf("✅ Linked %d plan-session relationships (%d plans linked)", linkCount, len(planLinked))
	return linkCount, nil
}
