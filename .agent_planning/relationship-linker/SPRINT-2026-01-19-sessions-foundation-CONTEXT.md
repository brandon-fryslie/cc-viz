# Implementation Context: sessions-foundation

**Sprint**: sessions-foundation
**Generated**: 2026-01-19

---

## Existing Patterns to Follow

### Schema Migration Pattern (storage_sqlite.go)

```go
func (s *SQLiteStorageService) runSessionsMigrations() error {
    // Check table existence
    var tableExists int
    err := s.db.QueryRow("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='sessions'").Scan(&tableExists)
    if err != nil {
        return err
    }

    if tableExists == 0 {
        // Create table
        _, err = s.db.Exec(`
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
        `)
        if err != nil {
            return err
        }

        // Populate from existing data
        _, err = s.db.Exec(`
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
        `)
        if err != nil {
            return err
        }
    }

    return nil
}
```

Hook into createTables():
```go
func (s *SQLiteStorageService) createTables() error {
    // ... existing migrations ...

    if err := s.runSessionsMigrations(); err != nil {
        return fmt.Errorf("sessions migrations failed: %w", err)
    }

    return nil
}
```

### Handler Pattern (data_handler.go)

```go
func (h *DataHandler) GetSessionsV2(w http.ResponseWriter, r *http.Request) {
    limit := 50
    offset := 0

    if l := r.URL.Query().Get("limit"); l != "" {
        if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
            limit = parsed
        }
    }
    if o := r.URL.Query().Get("offset"); o != "" {
        if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
            offset = parsed
        }
    }

    sessions, err := h.storage.GetSessions(limit, offset)
    if err != nil {
        writeErrorResponse(w, "Failed to get sessions: "+err.Error(), http.StatusInternalServerError)
        return
    }

    // Get total count
    stats, _ := h.storage.GetSessionStats()
    total := 0
    if stats != nil {
        total = stats.TotalSessions
    }

    writeJSONResponse(w, map[string]interface{}{
        "sessions": sessions,
        "total":    total,
        "limit":    limit,
        "offset":   offset,
    })
}
```

### Route Registration (main.go)

```go
// In registerRoutes()
r.HandleFunc("/api/v2/claude/sessions", h.GetSessionsV2).Methods("GET")
r.HandleFunc("/api/v2/claude/sessions/stats", h.GetSessionStatsV2).Methods("GET")
r.HandleFunc("/api/v2/claude/sessions/{id}", h.GetSessionDetailV2).Methods("GET")
```

Note: `/stats` route MUST be registered BEFORE `/{id}` to avoid route conflict.

---

## Key Files Reference

| File | Line Range | Purpose |
|------|------------|---------|
| `internal/service/storage_sqlite.go` | 1-100 | Schema migration examples |
| `internal/service/storage_sqlite.go` | ~800 | Query patterns |
| `internal/model/models.go` | Full file | Existing model structs |
| `internal/handler/data_handler.go` | ~1400 | V2 handler examples |
| `cmd/viz-server/main.go` | ~200 | Route registration |

---

## SQL Queries

### GetSessions
```sql
SELECT id, project_path, started_at, ended_at,
       conversation_count, message_count, agent_count, todo_count, created_at
FROM sessions
ORDER BY started_at DESC
LIMIT ? OFFSET ?
```

### GetSession
```sql
SELECT id, project_path, started_at, ended_at,
       conversation_count, message_count, agent_count, todo_count, created_at
FROM sessions
WHERE id = ?
```

### GetSessionStats
```sql
SELECT
    COUNT(*) as total_sessions,
    SUM(CASE WHEN ended_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) as active_sessions,
    SUM(message_count) as total_messages,
    COUNT(DISTINCT project_path) as unique_projects
FROM sessions
```

---

## Data Source Analysis

Current session_id distribution:
- ~1,023 unique session_ids in conversation_messages
- session_id format: UUID strings
- Some messages have null session_id (filter these out)

Join strategy:
- conversation_messages.conversation_id → conversations.id (get project_path)
- Group by session_id to aggregate stats
