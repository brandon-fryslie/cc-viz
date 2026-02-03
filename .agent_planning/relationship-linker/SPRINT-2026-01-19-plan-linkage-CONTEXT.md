# Implementation Context: plan-linkage

**Sprint**: plan-linkage
**Generated**: 2026-01-19

---

## Plan Storage Location

Plans are stored:
1. **Database**: `claude_plans` table with metadata (id, file_name, display_name, etc.)
2. **Disk**: `~/.claude/plans/{file_name}` with actual markdown content

To extract UUIDs, must read files from disk.

---

## UUID Extraction Implementation

```go
package service

import (
    "os"
    "path/filepath"
    "regexp"
)

var uuidPattern = regexp.MustCompile(`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`)

func (rl *RelationshipLinker) ExtractSessionUUIDsFromPlan(filePath string) ([]string, error) {
    content, err := os.ReadFile(filePath)
    if err != nil {
        return nil, err
    }

    matches := uuidPattern.FindAllString(string(content), -1)

    // Deduplicate
    seen := make(map[string]bool)
    var unique []string
    for _, m := range matches {
        if !seen[m] {
            seen[m] = true
            unique = append(unique, m)
        }
    }

    return unique, nil
}

func (rl *RelationshipLinker) LinkPlansToSessions(plansDir string) error {
    // Get all plans from database
    plans, err := rl.storage.GetAllPlans()
    if err != nil {
        return err
    }

    // Get all valid session IDs for validation
    sessionIDs, err := rl.storage.GetAllSessionIDs()
    if err != nil {
        return err
    }
    validSessions := make(map[string]bool)
    for _, id := range sessionIDs {
        validSessions[id] = true
    }

    for _, plan := range plans {
        filePath := filepath.Join(plansDir, plan.FileName)

        uuids, err := rl.ExtractSessionUUIDsFromPlan(filePath)
        if err != nil {
            // File may not exist, skip
            continue
        }

        linkedAny := false
        for _, uuid := range uuids {
            if validSessions[uuid] {
                err = rl.storage.LinkPlanToSession(plan.ID, uuid, "referenced", "high")
                if err == nil {
                    linkedAny = true
                }
            }
        }

        // If no UUID found, try temporal matching
        if !linkedAny {
            rl.tryTemporalMatch(plan, filePath)
        }
    }

    return nil
}

func (rl *RelationshipLinker) tryTemporalMatch(plan *model.Plan, filePath string) {
    info, err := os.Stat(filePath)
    if err != nil {
        return
    }

    mtime := info.ModTime()
    // Find sessions active within 1 hour of file modification
    sessions, err := rl.storage.GetSessionsActiveAt(mtime, time.Hour)
    if err != nil || len(sessions) != 1 {
        // Too ambiguous or no match
        return
    }

    // Single session match - link with medium confidence
    rl.storage.LinkPlanToSession(plan.ID, sessions[0].ID, "created", "medium")
}
```

---

## SQL Queries

### LinkPlanToSession
```sql
INSERT OR IGNORE INTO plan_session_map
  (plan_id, session_id, relationship, confidence)
VALUES (?, ?, ?, ?)
```

### GetPlanSessions
```sql
SELECT s.id, s.project_path, s.started_at, s.ended_at,
       psm.relationship, psm.confidence
FROM plan_session_map psm
JOIN sessions s ON psm.session_id = s.id
WHERE psm.plan_id = ?
ORDER BY psm.discovered_at DESC
```

### GetSessionPlans
```sql
SELECT p.id, p.file_name, p.display_name, p.status,
       psm.relationship, psm.confidence
FROM plan_session_map psm
JOIN claude_plans p ON psm.plan_id = p.id
WHERE psm.session_id = ?
ORDER BY psm.discovered_at DESC
```

### GetSessionsActiveAt (for temporal matching)
```sql
SELECT id, project_path, started_at, ended_at
FROM sessions
WHERE started_at <= datetime(?, '+1 hour')
  AND ended_at >= datetime(?, '-1 hour')
```

### GetAllSessionIDs
```sql
SELECT id FROM sessions
```

---

## Full Session Detail Query

Combine multiple queries:

```go
func (h *DataHandler) GetSessionDetailV2(w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    sessionID := vars["id"]

    // Get base session
    session, err := h.storage.GetSession(sessionID)
    if err != nil || session == nil {
        writeErrorResponse(w, "Session not found", http.StatusNotFound)
        return
    }

    // Get related entities (parallel if needed)
    conversations, _ := h.storage.GetSessionConversations(sessionID)
    files, _ := h.storage.GetSessionFileChanges(sessionID)
    plans, _ := h.storage.GetSessionPlans(sessionID)
    todos, _ := h.storage.GetTodosBySession(sessionID)
    subagents, _ := h.storage.GetSubagentsBySession(sessionID)

    response := map[string]interface{}{
        "id":                 session.ID,
        "project_path":       session.ProjectPath,
        "started_at":         session.StartedAt,
        "ended_at":           session.EndedAt,
        "conversation_count": session.ConversationCount,
        "message_count":      session.MessageCount,
        "conversations":      conversations,
        "files":              files,
        "plans":              plans,
        "todos":              todos,
        "subagents":          subagents,
    }

    writeJSONResponse(w, response)
}
```

---

## Existing Methods to Reuse

Check if these already exist in storage:
- `GetTodosBySession(sessionID)` - may exist in session_data_indexer
- `GetSubagentsBySession(sessionID)` - likely exists in subagent_indexer

If not, add them following existing patterns in those services.
