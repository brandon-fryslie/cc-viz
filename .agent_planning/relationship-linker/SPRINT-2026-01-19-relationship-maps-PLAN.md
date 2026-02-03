# Sprint: relationship-maps

**Generated**: 2026-01-19
**Confidence**: HIGH
**Status**: READY FOR IMPLEMENTATION

---

## Sprint Goal

Create session-conversation mapping table and file change tracking from tool output parsing.

---

## Scope

**Deliverables**:
1. Session-conversation mapping table with population
2. File change tracking table and extraction logic
3. Bidirectional lookup APIs

---

## Work Items

### P0: Session-Conversation Map Table

**Files to Modify**:
- `internal/service/storage_sqlite.go`

**Implementation**:
```sql
CREATE TABLE IF NOT EXISTS session_conversation_map (
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
CREATE INDEX IF NOT EXISTS idx_scm_session ON session_conversation_map(session_id);
CREATE INDEX IF NOT EXISTS idx_scm_conversation ON session_conversation_map(conversation_id);
```

**Population Query**:
```sql
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
```

**Acceptance Criteria**:
- [ ] Table created with proper foreign keys
- [ ] Population inserts ~5,000+ rows (sessions x conversations)
- [ ] Bidirectional lookups work (session→convos, convo→sessions)
- [ ] Index speeds up both directions

---

### P1: Session File Changes Table

**Files to Modify**:
- `internal/service/storage_sqlite.go`

**Implementation**:
```sql
CREATE TABLE IF NOT EXISTS session_file_changes (
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
CREATE INDEX IF NOT EXISTS idx_sfc_session ON session_file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_sfc_path ON session_file_changes(file_path);
```

**Acceptance Criteria**:
- [ ] Table created with session FK
- [ ] Indexes support both session→files and file→sessions queries
- [ ] change_type values: 'write', 'edit', 'bash_create', 'bash_modify'

---

### P2: RelationshipLinker Service (NEW FILE)

**Files to Create**:
- `internal/service/relationship_linker.go`

**Purpose**: Extract file changes from tool_use content in conversation_messages.

**Implementation Outline**:
```go
type RelationshipLinker struct {
    storage *SQLiteStorageService
}

func NewRelationshipLinker(storage *SQLiteStorageService) *RelationshipLinker

func (rl *RelationshipLinker) ExtractAndSaveFileChanges() error
// 1. Query messages with tool_use content
// 2. Parse JSON for Write/Edit/Bash tools
// 3. Extract file_path from tool input
// 4. Insert into session_file_changes

func (rl *RelationshipLinker) ParseToolUse(content string) []FileChange
// Parse tool_use JSON, return extracted file paths
```

**Tool Parsing Rules**:
- Write tool: `{"name": "Write", "input": {"file_path": "..."}}` → change_type='write'
- Edit tool: `{"name": "Edit", "input": {"file_path": "..."}}` → change_type='edit'
- Bash tool: Best effort regex for `> file`, `cat > file`, `echo > file`

**Acceptance Criteria**:
- [ ] RelationshipLinker struct created
- [ ] ExtractAndSaveFileChanges populates session_file_changes
- [ ] Write and Edit tool outputs correctly parsed
- [ ] Bash file operations detected (best effort)
- [ ] Duplicate file changes handled (UNIQUE constraint or INSERT OR IGNORE)

---

### P3: Model Structs

**Files to Modify**:
- `internal/model/models.go`

**Structs to Add**:
```go
type SessionConversationMap struct {
    ID              int       `json:"id"`
    SessionID       string    `json:"session_id"`
    ConversationID  string    `json:"conversation_id"`
    FirstMessageUUID string   `json:"first_message_uuid,omitempty"`
    LastMessageUUID  string   `json:"last_message_uuid,omitempty"`
    MessageCount    int       `json:"message_count"`
    CreatedAt       time.Time `json:"created_at"`
}

type SessionFileChange struct {
    ID          int        `json:"id"`
    SessionID   string     `json:"session_id"`
    FilePath    string     `json:"file_path"`
    ChangeType  string     `json:"change_type"`
    ToolName    string     `json:"tool_name,omitempty"`
    MessageUUID string     `json:"message_uuid,omitempty"`
    Timestamp   *time.Time `json:"timestamp,omitempty"`
    CreatedAt   time.Time  `json:"created_at"`
}
```

**Acceptance Criteria**:
- [ ] Both structs defined with proper JSON tags
- [ ] Nullable fields use pointer types

---

### P4: Storage Interface Methods

**Files to Modify**:
- `internal/service/storage.go`
- `internal/service/storage_sqlite.go`

**Methods to Add**:
```go
// Session → Conversations
GetSessionConversations(sessionID string) ([]*model.IndexedConversation, error)

// Conversation → Sessions (bidirectional)
GetConversationSessions(conversationID string) ([]*model.Session, error)

// Session → Files
GetSessionFileChanges(sessionID string) ([]*model.SessionFileChange, error)

// File → Sessions (bidirectional)
GetFileChangeSessions(filePath string) ([]*model.Session, error)

// Save file change
SaveFileChange(change *model.SessionFileChange) error
```

**Acceptance Criteria**:
- [ ] All methods implemented
- [ ] GetSessionConversations returns conversations with message counts
- [ ] GetConversationSessions returns sessions ordered by activity
- [ ] GetSessionFileChanges returns files ordered by timestamp
- [ ] GetFileChangeSessions supports path prefix matching (for directory queries)

---

### P5: API Endpoints

**Files to Modify**:
- `internal/handler/data_handler.go`
- `cmd/viz-server/main.go`

**Endpoints**:
```
GET /api/v2/claude/sessions/{id}/conversations    - Conversations for session
GET /api/v2/claude/sessions/{id}/files            - File changes for session
GET /api/v2/claude/conversations/{id}/sessions    - Sessions for conversation
GET /api/v2/claude/files                          - File changes with filters
  ?path=/prefix  - Filter by path prefix
  ?session=id    - Filter by session
```

**Extend Existing**:
- `GET /api/v2/claude/sessions/{id}` should now include `conversations` and `files` arrays

**Acceptance Criteria**:
- [ ] All new endpoints return proper JSON
- [ ] Session detail includes related conversations and files
- [ ] Bidirectional navigation works (session↔conversation, session↔file)
- [ ] Path prefix filtering works for file queries

---

## Dependencies

- Sprint 1 (sessions-foundation): Sessions table must exist

---

## Risks

| Risk | Mitigation |
|------|------------|
| Tool parsing misses edge cases | Start with Write/Edit only, iterate on Bash |
| Large volume of file changes | Batch inserts, only track unique (session, path, timestamp) |
| Performance on bidirectional queries | Indexes on both columns of junction tables |

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] `just test` passes
- [ ] `just check` passes
- [ ] Relationship maps populated from existing data
- [ ] File changes extracted from tool_use content
- [ ] Bidirectional APIs verified manually
