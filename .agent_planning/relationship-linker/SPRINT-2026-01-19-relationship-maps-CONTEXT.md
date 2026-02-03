# Implementation Context: relationship-maps

**Sprint**: relationship-maps
**Generated**: 2026-01-19

---

## Tool Output Parsing

### Write Tool Format
Message content contains:
```json
{
  "tool_use": {
    "id": "toolu_...",
    "name": "Write",
    "input": {
      "file_path": "/absolute/path/to/file.go",
      "content": "..."
    }
  }
}
```

### Edit Tool Format
```json
{
  "tool_use": {
    "id": "toolu_...",
    "name": "Edit",
    "input": {
      "file_path": "/absolute/path/to/file.go",
      "old_string": "...",
      "new_string": "..."
    }
  }
}
```

### Bash Tool (Best Effort)
Look for patterns like:
- `> filename` or `>> filename`
- `cat > filename`
- `echo "..." > filename`
- `touch filename`

Regex: `(?:>|cat\s*>|echo\s+.*>|touch\s+)[\s"']*([^\s"'|;&]+)`

---

## RelationshipLinker Implementation

```go
package service

import (
    "encoding/json"
    "regexp"
    "strings"
    "github.com/your/project/internal/model"
)

type RelationshipLinker struct {
    storage *SQLiteStorageService
}

func NewRelationshipLinker(storage *SQLiteStorageService) *RelationshipLinker {
    return &RelationshipLinker{storage: storage}
}

type toolUseContent struct {
    ToolUse struct {
        Name  string          `json:"name"`
        Input json.RawMessage `json:"input"`
    } `json:"tool_use"`
}

type writeInput struct {
    FilePath string `json:"file_path"`
}

type editInput struct {
    FilePath string `json:"file_path"`
}

type bashInput struct {
    Command string `json:"command"`
}

var bashFilePattern = regexp.MustCompile(`(?:>\s*|cat\s*>\s*|echo\s+[^>]*>\s*|touch\s+)["']?([^\s"'|;&>]+)`)

func (rl *RelationshipLinker) ExtractFileChanges(content string) []*model.SessionFileChange {
    var changes []*model.SessionFileChange

    var tool toolUseContent
    if err := json.Unmarshal([]byte(content), &tool); err != nil {
        return nil
    }

    switch tool.ToolUse.Name {
    case "Write":
        var input writeInput
        if json.Unmarshal(tool.ToolUse.Input, &input) == nil && input.FilePath != "" {
            changes = append(changes, &model.SessionFileChange{
                FilePath:   input.FilePath,
                ChangeType: "write",
                ToolName:   "Write",
            })
        }

    case "Edit":
        var input editInput
        if json.Unmarshal(tool.ToolUse.Input, &input) == nil && input.FilePath != "" {
            changes = append(changes, &model.SessionFileChange{
                FilePath:   input.FilePath,
                ChangeType: "edit",
                ToolName:   "Edit",
            })
        }

    case "Bash":
        var input bashInput
        if json.Unmarshal(tool.ToolUse.Input, &input) == nil {
            matches := bashFilePattern.FindAllStringSubmatch(input.Command, -1)
            for _, match := range matches {
                if len(match) > 1 && !strings.HasPrefix(match[1], "-") {
                    changes = append(changes, &model.SessionFileChange{
                        FilePath:   match[1],
                        ChangeType: "bash",
                        ToolName:   "Bash",
                    })
                }
            }
        }
    }

    return changes
}
```

---

## SQL Queries

### Populate session_conversation_map
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

### GetSessionConversations
```sql
SELECT c.id, c.title, c.project_path, c.file_path,
       scm.message_count, scm.first_message_uuid, scm.last_message_uuid
FROM session_conversation_map scm
JOIN conversations c ON scm.conversation_id = c.id
WHERE scm.session_id = ?
ORDER BY scm.message_count DESC
```

### GetConversationSessions
```sql
SELECT s.id, s.project_path, s.started_at, s.ended_at,
       s.message_count, s.conversation_count
FROM session_conversation_map scm
JOIN sessions s ON scm.session_id = s.id
WHERE scm.conversation_id = ?
ORDER BY s.started_at DESC
```

### GetSessionFileChanges
```sql
SELECT id, session_id, file_path, change_type, tool_name,
       message_uuid, timestamp, created_at
FROM session_file_changes
WHERE session_id = ?
ORDER BY timestamp DESC
```

### GetFileChangeSessions
```sql
SELECT DISTINCT s.id, s.project_path, s.started_at, s.ended_at
FROM session_file_changes sfc
JOIN sessions s ON sfc.session_id = s.id
WHERE sfc.file_path LIKE ? || '%'
ORDER BY s.started_at DESC
```

---

## Message Content Location

Tool outputs are in `conversation_messages.content` field.

Query to find messages with tool_use:
```sql
SELECT uuid, session_id, conversation_id, content, timestamp
FROM conversation_messages
WHERE content LIKE '%"tool_use"%'
  AND session_id IS NOT NULL
```

Expected volume: ~50,000+ messages with tool_use content
