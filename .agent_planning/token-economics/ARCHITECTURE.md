# Token Economics Page - Architecture Overview

**Document Type:** Implementation Architecture
**Audience:** Engineers implementing the fix
**Date:** 2026-01-20

---

## Current Architecture

### Frontend (React)
```
TokenEconomicsPage
├── useWeeklyStats() → /api/v2/stats
│   └── DashboardStats { dailyStats[] }
│       └── DailyTokens { date, tokens, requests, models }
├── useConversations() → /api/v2/conversations
│   └── Conversation[] { messageCount, projectName, ... }
│       └── **PROBLEM: NO token fields**
└── Components
    ├── StatCard (key metrics)
    ├── DailyBurnChart (line chart)
    ├── ModelBreakdownChart (pie)
    ├── ProjectBreakdownChart (pie) **← uses messageCount * 1000**
    ├── AnomalyAlerts
    └── DataList (table) **← uses messageCount * 1000**
```

### Backend (Go)
```
/api/v2/stats → GetWeeklyStatsV2()
  └── QueryBuilder.GetStats(start, end)
      └── SELECT SUM(tokens) FROM requests
          └── **Accurate data** ✅

/api/v2/conversations → GetConversationsV2()
  └── QueryBuilder.GetConversations(limit, offset)
      └── SELECT messageCount FROM conversations
          └── **Missing token data** ❌
```

### Database
```sql
-- Accurate token data exists here:
conversation_messages {
  id, conversation_id, input_tokens, output_tokens,
  cache_read_tokens, cache_creation_tokens, model
}

-- But only exposed via:
-- GET /api/v2/conversations/{id}/messages (paginated)
-- Not aggregated: GET /api/v2/conversations (list)
```

---

## Target Architecture

### New API Endpoints

#### 1. Conversation Token Summary
```
GET /api/v2/conversations/{id}/token-summary

Response:
{
  "conversationId": "uuid",
  "totalTokens": 150000,
  "inputTokens": 75000,
  "outputTokens": 75000,
  "cacheReadTokens": 0,
  "cacheCreationTokens": 0,
  "messageCount": 50,
  "avgTokensPerMessage": 3000,
  "byModel": {
    "claude-opus-4": {
      "totalTokens": 100000,
      "inputTokens": 50000,
      "outputTokens": 50000,
      ...
    }
  }
}
```

**Implementation:**
```go
// storage_sqlite.go
func (s *StorageService) GetConversationTokenSummary(conversationID string) (*ConversationTokenSummary, error) {
  // Query conversation_messages with GROUP BY model
  // Return aggregated token counts
}

// data_handler.go
func (h *DataHandler) GetConversationTokenSummaryV2(w http.ResponseWriter, r *http.Request) {
  conversationID := mux.Vars(r)["id"]
  summary, err := h.storageService.GetConversationTokenSummary(conversationID)
  // Return JSON
}
```

#### 2. Project Token Aggregation
```
GET /api/v2/stats/projects?start=2026-01-01&end=2026-01-31

Response:
{
  "projects": [
    {
      "name": "cc-viz",
      "totalTokens": 500000,
      "conversationCount": 25,
      "topConversations": [
        { "conversationId": "uuid", "totalTokens": 50000, "messageCount": 30 }
      ]
    }
  ]
}
```

**Implementation:**
```go
// storage_sqlite.go
func (s *StorageService) GetProjectTokenStats(start, end time.Time) ([]ProjectTokenStat, error) {
  // Query conversation_messages grouped by project
  // Return sorted by total tokens DESC
}

// data_handler.go
func (h *DataHandler) GetProjectTokenStatsV2(w http.ResponseWriter, r *http.Request) {
  // Parse start/end from query
  // Call storage method
  // Return JSON
}
```

#### 3. Updated Conversation List
```
GET /api/v2/conversations

Response:
[
  {
    "id": "uuid",
    "projectName": "cc-viz",
    "messageCount": 50,
    "totalTokens": 150000,        // NEW
    "inputTokens": 75000,         // NEW
    "outputTokens": 75000,        // NEW
    ...
  }
]
```

**Implementation:**
```go
// Update GetConversations() query to include LEFT JOIN with conversation_messages
SELECT c.id, c.project_name, c.message_count,
       COALESCE(SUM(cm.input_tokens + cm.output_tokens), 0) as total_tokens,
       COALESCE(SUM(cm.input_tokens), 0) as input_tokens,
       COALESCE(SUM(cm.output_tokens), 0) as output_tokens
FROM conversations c
LEFT JOIN conversation_messages cm ON c.id = cm.conversation_id
GROUP BY c.id
```

---

## Data Flow Changes

### BEFORE (With Estimates)
```
Frontend                          Backend
  │                                 │
  ├─→ GET /api/v2/conversations ────→ SELECT messageCount
  │   Response: { messageCount: 50 }
  │
  └─→ Multiply by 1000: 50 * 1000 = 50,000 tokens (FAKE)
      ↓
      Display to user (WRONG DATA)
```

### AFTER (With Real Data)
```
Frontend                          Backend
  │                                 │
  ├─→ GET /api/v2/conversations ────→ SELECT SUM(tokens) FROM conversation_messages
  │   Response: { totalTokens: 45,231 }
  │
  └─→ Display to user (ACCURATE DATA)
```

---

## Type Changes

### TypeScript (frontend/src/lib/types.ts)

```typescript
// BEFORE
interface Conversation {
  id: string
  projectName: string
  messageCount: number
  // NO token fields
}

// AFTER
interface Conversation {
  id: string
  projectName: string
  messageCount: number
  totalTokens: number      // NEW
  inputTokens: number      // NEW
  outputTokens: number     // NEW
}

// NEW types
interface ConversationTokenSummary {
  conversationId: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  messageCount: number
  avgTokensPerMessage: number
  byModel: Record<string, TokenBreakdown>
}

interface TokenBreakdown {
  model: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  messageCount: number
}

interface ProjectTokenStat {
  name: string
  totalTokens: number
  conversationCount: number
  topConversations: ConversationTokenBreakdown[]
}
```

### Go (internal/model/models.go)

```go
// BEFORE
type Conversation struct {
  ID             string    `json:"id"`
  ProjectName    string    `json:"projectName"`
  MessageCount   int64     `json:"messageCount"`
  // NO token fields
}

// AFTER
type Conversation struct {
  ID             string    `json:"id"`
  ProjectName    string    `json:"projectName"`
  MessageCount   int64     `json:"messageCount"`
  TotalTokens    int64     `json:"totalTokens"`      // NEW
  InputTokens    int64     `json:"inputTokens"`      // NEW
  OutputTokens   int64     `json:"outputTokens"`     // NEW
}

// NEW types
type ConversationTokenSummary struct {
  ConversationID      string                     `json:"conversationId"`
  TotalTokens         int64                      `json:"totalTokens"`
  InputTokens         int64                      `json:"inputTokens"`
  OutputTokens        int64                      `json:"outputTokens"`
  CacheReadTokens     int64                      `json:"cacheReadTokens"`
  CacheCreationTokens int64                      `json:"cacheCreationTokens"`
  MessageCount        int64                      `json:"messageCount"`
  AvgTokensPerMessage int64                      `json:"avgTokensPerMessage"`
  ByModel             map[string]*TokenBreakdown `json:"byModel"`
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

type ProjectTokenStat struct {
  Name               string                         `json:"name"`
  TotalTokens        int64                          `json:"totalTokens"`
  ConversationCount  int64                          `json:"conversationCount"`
  TopConversations   []ConversationTokenBreakdown   `json:"topConversations"`
}

type ConversationTokenBreakdown struct {
  ConversationID string `json:"conversationId"`
  TotalTokens    int64  `json:"totalTokens"`
  MessageCount   int64  `json:"messageCount"`
}
```

---

## Component Changes

### TokenEconomicsPage.tsx

```typescript
// BEFORE: Using estimates
const projectStats = useMemo(() => {
  const projectMap = new Map()
  conversations.forEach((conv) => {
    const tokens = conv.messageCount * 1000  // FAKE
    // ...
  })
}, [conversations])

// AFTER: Using real data
const { data: projectStatsData } = useProjectTokenStats(dateRange)
const projectStats = useMemo(() => {
  return projectStatsData?.projects ?? []
}, [projectStatsData])
```

### Session Table

```typescript
// BEFORE
sessionData.map((conv) => ({
  tokens: conv.messageCount * 1000  // FAKE
}))

// AFTER
sessionData.map((conv) => ({
  tokens: conv.totalTokens  // REAL
}))
```

---

## Database Queries

### Query 1: Conversation Token Summary
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

### Query 2: Project Token Stats
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

### Query 3: Updated Conversation List
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

---

## Performance Considerations

### New Indexes Needed
```sql
-- For conversation token summary queries
CREATE INDEX idx_conversation_messages_conversation_id
ON conversation_messages(conversation_id);

-- For project token stats
CREATE INDEX idx_conversations_project_name_created_at
ON conversations(project_name, created_at);

-- For conversation list aggregation
CREATE INDEX idx_conversation_messages_conversation_id_tokens
ON conversation_messages(conversation_id, input_tokens, output_tokens);
```

### Query Performance Targets
- `GetConversationTokenSummary()` - < 100ms (for 1000 messages)
- `GetProjectTokenStats()` - < 500ms (for 10k conversations)
- `GetConversationsV2()` - < 1s (for 1000 conversations with token aggregation)

---

## Error Handling Architecture

### API Level
```go
// Return proper HTTP status codes
if conversationNotFound {
  return http.StatusNotFound, "Conversation not found"
}
if queryError {
  return http.StatusInternalServerError, "Failed to get token summary"
}
if invalidInput {
  return http.StatusBadRequest, "Invalid conversation ID format"
}
```

### Frontend Level
```typescript
// Error boundary catches uncaught errors
<ErrorBoundary>
  <TokenEconomicsPage />
</ErrorBoundary>

// Per-component error handling
if (weeklyError && !weeklyStats) {
  return <ErrorAlert message={weeklyError.message} onRetry={refetch} />
}

// Per-chart error handling
{projectError && (
  <div className="bg-yellow-50 p-3 rounded">
    Project breakdown unavailable: {projectError.message}
  </div>
)}
```

---

## Deployment Strategy

### Phase 1: Backend (No Frontend Changes)
1. Deploy new API endpoints (`/conversations/{id}/token-summary`, `/stats/projects`)
2. Deploy updated `Conversation` type with token fields
3. Run validation script to verify data
4. Monitor API performance

**Rollback:** Remove new endpoints, revert Conversation type (safe, no consumer code yet)

### Phase 2: Frontend (Uses New Endpoints)
1. Deploy updated frontend that uses new token fields
2. Remove all `messageCount * 1000` references
3. Monitor for errors
4. Run manual QA checklist

**Rollback:** Revert to previous frontend (uses old data)

### Phase 3: Cleanup (Optional, Later)
1. Remove old `messageCount * 1000` code comments
2. Optimize indexes if needed
3. Archive old implementation documentation

---

## Monitoring & Validation

### Validation Script
```bash
# Run after each deployment
node scripts/validate-token-economics.js

Checks:
✓ No messageCount * 1000 in code
✓ Daily stats total = sum of conversations
✓ Project stats total = sum of conversations in project
✓ No negative token counts
✓ All token counts reasonable (< 1 billion)
```

### Metrics to Monitor
- API response time for new endpoints (target: < 500ms)
- Error rate on new endpoints (target: < 0.1%)
- Data discrepancies between daily/conversation stats (target: 0%)
- Page load time (target: < 2s)

---

## Backward Compatibility

### API Versioning
- New endpoints are V2 (`/api/v2/...`)
- Old endpoints unchanged (V1 still works)
- Old code can use either version
- No forced migration

### Type Changes
- `Conversation` type gains new fields
- Old code ignoring new fields continues to work
- New code uses new fields
- No breaking changes

---

## Code Organization

### Files to Modify

**Backend:**
- `internal/service/storage_sqlite.go` - Add storage methods
- `internal/handler/data_handler.go` - Add API endpoints
- `internal/model/models.go` - Add types
- `cmd/viz-server/main.go` - Register routes (if needed)

**Frontend:**
- `frontend/src/lib/types.ts` - Update types
- `frontend/src/lib/api.ts` - Add hooks
- `frontend/src/pages/TokenEconomics.tsx` - Update component
- `frontend/src/components/ui/ErrorBoundary.tsx` - New component

**Testing:**
- `internal/service/storage_sqlite_test.go` - Storage tests
- `internal/handler/data_handler_test.go` - API endpoint tests
- `frontend/src/pages/TokenEconomics.test.tsx` - Component tests
- `scripts/validate-token-economics.js` - Validation script

---

## Summary

The fix involves:

1. **Add 3 new storage methods** - Query database for real token data
2. **Add 2-3 new API endpoints** - Expose token data to frontend
3. **Update 1 API response type** - Add token fields to Conversation
4. **Update 3 TypeScript types** - Match backend changes
5. **Update 1 React component** - Use real data instead of estimates
6. **Add error handling** - ErrorBoundary + error UI
7. **Add tests** - Unit, integration, and validation tests

**Total code changes:** ~500 lines of implementation, ~1000 lines of tests

**Result:** 100% production-ready Token Economics page with real data, proper error handling, and complete test coverage.
