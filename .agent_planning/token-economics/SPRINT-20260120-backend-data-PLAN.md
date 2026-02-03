# Sprint: Backend Data - Add Real Conversation Token Endpoints

**Generated:** 2026-01-20
**Confidence:** HIGH
**Status:** READY FOR IMPLEMENTATION

## Sprint Goal

Expose actual token counts for conversations via new API endpoints, replacing the need for frontend estimation (`messageCount * 1000`).

## Scope

**Deliverables:**

1. **Backend storage method:** `GetConversationTokenSummary(conversationID)`
   - Queries `conversation_messages` table
   - Returns: input tokens, output tokens, total tokens, message count, per-model breakdown
   - Used by both API endpoints and page rendering

2. **New API endpoint:** `GET /api/v2/conversations/{id}/token-summary`
   - Returns detailed token metrics for a single conversation
   - Used by conversation detail view or expanded row in table

3. **New API endpoint:** `GET /api/v2/stats/projects?start=...&end=...`
   - Aggregates tokens by project
   - Returns project name, total tokens, conversation count, top conversations
   - Used by project breakdown chart

4. **Update Conversation type:** Add token fields
   - `totalTokens: number`
   - `inputTokens: number`
   - `outputTokens: number`
   - Returned by `GET /api/v2/conversations` list endpoint

## Work Items

### P0: Backend Storage Method - GetConversationTokenSummary

**File:** `internal/service/storage_sqlite.go`

**Acceptance Criteria:**
- [ ] Method signature: `GetConversationTokenSummary(conversationID string) (*ConversationTokenSummary, error)`
- [ ] Queries `conversation_messages` WHERE `conversation_id = ?`
- [ ] Returns struct with: totalTokens, inputTokens, outputTokens, messageCount, byModel map
- [ ] Handles zero messages gracefully (returns zeros, not nil)

**SQL Query:**
```sql
SELECT
  COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_creation_tokens), 0) as total_tokens,
  COALESCE(SUM(input_tokens), 0) as input_tokens,
  COALESCE(SUM(output_tokens), 0) as output_tokens,
  COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
  COALESCE(SUM(cache_creation_tokens), 0) as cache_creation_tokens,
  COUNT(*) as message_count,
  model
FROM conversation_messages
WHERE conversation_id = ?
GROUP BY model
ORDER BY total_tokens DESC
```

**Technical Notes:**
- Use prepared statements for security
- Return structure should nest model stats in a map
- If conversation doesn't exist, return empty struct (0 tokens, 0 messages)
- Test with missing conversation to ensure no panic

### P1: Add ConversationTokenSummary Type

**File:** `internal/model/models.go`

**Acceptance Criteria:**
- [ ] Type includes: TotalTokens, InputTokens, OutputTokens, CacheReadTokens, CacheCreationTokens, MessageCount, ByModel map
- [ ] ByModel map key = model name, value = TokenBreakdown struct
- [ ] TokenBreakdown includes same fields as parent
- [ ] JSON marshaling works (test with `json.Marshal`)

**Type Definition:**
```go
type ConversationTokenSummary struct {
  TotalTokens         int64                            `json:"totalTokens"`
  InputTokens         int64                            `json:"inputTokens"`
  OutputTokens        int64                            `json:"outputTokens"`
  CacheReadTokens     int64                            `json:"cacheReadTokens"`
  CacheCreationTokens int64                            `json:"cacheCreationTokens"`
  MessageCount        int64                            `json:"messageCount"`
  AvgTokensPerMessage int64                            `json:"avgTokensPerMessage"`
  ByModel             map[string]*TokenBreakdown       `json:"byModel"`
}

type TokenBreakdown struct {
  Model               string `json:"model"`
  TotalTokens         int64  `json:"totalTokens"`
  InputTokens         int64  `json:"inputTokens"`
  OutputTokens        int64  `json:"outputTokens"`
  CacheReadTokens     int64  `json:"cacheReadTokens"`
  CacheCreationTokens int64  `json:"cacheCreationTokens"`
  MessageCount        int64  `json:"messageCount"`
}
```

**Technical Notes:**
- Add helper method `AvgTokensPerMessage` that safely divides by MessageCount
- Add method `ConversationTokenSummary.ByProject()` that sums across models
- Test JSON marshaling with `encoding/json`

### P2: API Endpoint - GET /api/v2/conversations/{id}/token-summary

**File:** `internal/handler/data_handler.go`

**Acceptance Criteria:**
- [ ] Method: `GetConversationTokenSummaryV2(w http.ResponseWriter, r *http.Request)`
- [ ] Route: `GET /api/v2/conversations/{id}/token-summary`
- [ ] Returns: `ConversationTokenSummary` as JSON
- [ ] Returns 404 if conversation doesn't exist
- [ ] Returns 500 with error message if query fails
- [ ] Validates conversationID is UUID format (or return 400)

**Handler Code Pattern:**
```go
func (h *DataHandler) GetConversationTokenSummaryV2(w http.ResponseWriter, r *http.Request) {
  conversationID := mux.Vars(r)["id"]

  // Validate UUID
  if _, err := uuid.Parse(conversationID); err != nil {
    writeErrorResponse(w, "Invalid conversation ID format", http.StatusBadRequest)
    return
  }

  summary, err := h.storageService.GetConversationTokenSummary(conversationID)
  if err != nil {
    h.logger.Printf("Error getting token summary for %s: %v", conversationID, err)
    writeErrorResponse(w, "Failed to get token summary", http.StatusInternalServerError)
    return
  }

  writeJSONResponse(w, summary)
}
```

**Technical Notes:**
- Register route in router: `router.HandleFunc("/conversations/{id}/token-summary", h.GetConversationTokenSummaryV2).Methods("GET")`
- Add request logging middleware
- Test with curl to ensure correct JSON output

### P3: API Endpoint - GET /api/v2/stats/projects

**File:** `internal/service/storage_sqlite.go` + `internal/handler/data_handler.go`

**Acceptance Criteria:**
- [ ] Storage method: `GetProjectTokenStats(start, end time.Time) ([]ProjectTokenStat, error)`
- [ ] Returns array of projects sorted by total tokens DESC
- [ ] Each project includes: Name, TotalTokens, ConversationCount, TopConversations (limit 5)
- [ ] Respects date range (start/end query parameters)
- [ ] Handler parses start/end from query string
- [ ] Returns 200 with array, or 400 if dates invalid

**SQL Query:**
```sql
SELECT
  c.project_name,
  COUNT(DISTINCT cm.conversation_id) as conversation_count,
  COALESCE(SUM(cm.input_tokens + cm.output_tokens + cm.cache_read_tokens + cm.cache_creation_tokens), 0) as total_tokens
FROM conversation_messages cm
JOIN conversations c ON cm.conversation_id = c.id
WHERE c.created_at BETWEEN ? AND ?
GROUP BY c.project_name
ORDER BY total_tokens DESC
```

**Type Definition:**
```go
type ProjectTokenStat struct {
  Name               string                    `json:"name"`
  TotalTokens        int64                     `json:"totalTokens"`
  ConversationCount  int64                     `json:"conversationCount"`
  TopConversations   []ConversationTokenBreakdown `json:"topConversations"`
}

type ConversationTokenBreakdown struct {
  ConversationID string `json:"conversationId"`
  TotalTokens    int64  `json:"totalTokens"`
  MessageCount   int64  `json:"messageCount"`
}
```

**Technical Notes:**
- Validate start/end dates (end >= start)
- Default to last 30 days if not specified
- Top 5 conversations per project ordered by tokens DESC
- Consider index on `conversations.project_name` for performance

### P4: Update Conversation List Response

**File:** `internal/model/models.go` + `internal/handler/data_handler.go`

**Acceptance Criteria:**
- [ ] `Conversation` type now includes: `TotalTokens`, `InputTokens`, `OutputTokens` fields
- [ ] `GetConversationsV2()` joins with conversation_messages to get token sums
- [ ] No performance regression (< 1 second for 1000 conversations)
- [ ] Fields are populated for all conversations returned

**Type Change:**
```go
type Conversation struct {
  ID              string    `json:"id"`
  ProjectName     string    `json:"projectName"`
  StartTime       time.Time `json:"startTime"`
  LastActivity    time.Time `json:"lastActivity"`
  MessageCount    int64     `json:"messageCount"`
  TotalTokens     int64     `json:"totalTokens"`      // NEW
  InputTokens     int64     `json:"inputTokens"`      // NEW
  OutputTokens    int64     `json:"outputTokens"`     // NEW
  RootRequestID   *string   `json:"rootRequestId,omitempty"`
}
```

**Updated Query:**
```sql
SELECT
  c.id,
  c.project_name,
  c.created_at,
  c.last_activity,
  COUNT(DISTINCT cm.id) as message_count,
  COALESCE(SUM(cm.input_tokens + cm.output_tokens + cm.cache_read_tokens + cm.cache_creation_tokens), 0) as total_tokens,
  COALESCE(SUM(cm.input_tokens), 0) as input_tokens,
  COALESCE(SUM(cm.output_tokens), 0) as output_tokens
FROM conversations c
LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
GROUP BY c.id
ORDER BY c.last_activity DESC
LIMIT ? OFFSET ?
```

**Technical Notes:**
- LEFT JOIN ensures conversations with 0 messages still appear (tokens = 0)
- Consider adding index on `conversation_messages.conversation_id`
- Test performance with 10k+ conversations
- Update frontend types in `lib/types.ts` to match

## Dependencies

- No external dependencies
- Requires conversation_messages table populated (assumed to be populated by indexer)
- Requires uuid package (already in go.mod)

## Risks

1. **Conversations with zero messages**
   - Mitigation: Handle explicitly in storage method - return 0 tokens, not error

2. **Model field in conversation_messages might be NULL**
   - Mitigation: Use COALESCE(model, 'unknown') in GROUP BY

---

## Implementation Order

1. Add storage method `GetConversationTokenSummary()`
2. Add `ConversationTokenSummary` and `TokenBreakdown` types
3. Add API endpoint `GetConversationTokenSummaryV2()`
4. Add storage method `GetProjectTokenStats()`
5. Add API endpoint for projects stats
6. Update `Conversation` type with token fields
7. Update `GetConversationsV2()` query to include tokens
8. Test all endpoints with curl/Postman
9. Update frontend to use new endpoints (separate sprint)

---

## Acceptance Criteria Summary

✅ All 4 new API endpoints working
✅ Conversation type includes actual token counts
✅ Endpoints return correct JSON structure
✅ All queries work with real data

---

## Commit Message

```
feat(api): add real token count endpoints for conversations and projects

- Add GetConversationTokenSummary() storage method
- Add GET /api/v2/conversations/{id}/token-summary endpoint
- Add GET /api/v2/stats/projects endpoint
- Update Conversation type to include totalTokens, inputTokens, outputTokens
- Update GetConversationsV2() to fetch actual token counts
- Fixes fundamentally inaccurate token estimation in Token Economics page
```
