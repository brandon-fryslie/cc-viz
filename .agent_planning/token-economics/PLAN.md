# Token Economics Page - Implementation Plan

**Project:** CC-Viz Token Economics Page
**Goal:** Make Token Economics page fully functional with real token data
**Scope:** Replace fake estimates with actual data, add error handling, add testing
**Confidence:** HIGH
**Created:** 2026-01-20

---

## Problem Statement

The Token Economics page displays fake token counts using the formula `messageCount * 1000`, which is:
- Completely inaccurate (no basis in actual token counts)
- Unusable for understanding real token consumption
- Not suitable for any serious use

The data actually exists in the database (`conversation_messages` table has `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`) but it's not exposed via API.

---

## Solution Overview

Three sequential sprints to make the page functional:

1. **Backend Sprint** - Expose real token data via API endpoints
2. **Frontend Sprint** - Replace estimates with real data + error handling
3. **Testing Sprint** - Verify accuracy with unit/integration tests + validation script

---

## Sprint 1: Backend Data Endpoints

### Goal
Expose actual token counts for conversations via new API endpoints, eliminating the need for frontend estimation.

### Deliverables

#### 1.1 Storage Method: GetConversationTokenSummary()
**File:** `internal/service/storage_sqlite.go`

Query `conversation_messages` table and aggregate tokens by conversation:

```go
func (s *StorageService) GetConversationTokenSummary(conversationID string) (*ConversationTokenSummary, error) {
	// SQL: GROUP BY conversation_id, model
	// Return: totalTokens, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, messageCount, byModel map
	// Handle zero messages gracefully
}
```

**SQL Pattern:**
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

#### 1.2 Add Types
**File:** `internal/model/models.go`

```go
type ConversationTokenSummary struct {
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
  Name               string                       `json:"name"`
  TotalTokens        int64                        `json:"totalTokens"`
  ConversationCount  int64                        `json:"conversationCount"`
  TopConversations   []ConversationTokenBreakdown `json:"topConversations"`
}

type ConversationTokenBreakdown struct {
  ConversationID string `json:"conversationId"`
  TotalTokens    int64  `json:"totalTokens"`
  MessageCount   int64  `json:"messageCount"`
}
```

#### 1.3 API Endpoint: GET /api/v2/conversations/{id}/token-summary
**File:** `internal/handler/data_handler.go`

```go
func (h *DataHandler) GetConversationTokenSummaryV2(w http.ResponseWriter, r *http.Request) {
	conversationID := mux.Vars(r)["id"]

	// Validate UUID format
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

Register route: `router.HandleFunc("/conversations/{id}/token-summary", h.GetConversationTokenSummaryV2).Methods("GET")`

#### 1.4 API Endpoint: GET /api/v2/stats/projects
**File:** `internal/service/storage_sqlite.go` + `internal/handler/data_handler.go`

Storage method: `GetProjectTokenStats(start, end time.Time) ([]ProjectTokenStat, error)`

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

Handler: Parse `start` and `end` from query parameters, default to last 30 days.

#### 1.5 Update Conversation Type
**File:** `internal/model/models.go`

Add to `Conversation` struct:
```go
TotalTokens  int64  `json:"totalTokens"`
InputTokens  int64  `json:"inputTokens"`
OutputTokens int64  `json:"outputTokens"`
```

Update `GetConversationsV2()` query to JOIN with `conversation_messages`:
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

### Implementation Order
1. Add `ConversationTokenSummary`, `TokenBreakdown`, `ProjectTokenStat` types
2. Add `GetConversationTokenSummary()` storage method
3. Add `GetConversationTokenSummaryV2()` API handler
4. Add `GetProjectTokenStats()` storage method + handler
5. Update `Conversation` type with token fields
6. Update `GetConversationsV2()` query
7. Register all routes
8. Test with curl/Postman

### Acceptance Criteria
- [ ] All 4 endpoints respond with correct JSON
- [ ] Conversation type includes token fields
- [ ] Data aggregation works correctly
- [ ] All queries handle missing data gracefully

### Effort
4-6 hours

---

## Sprint 2: Frontend Real Data + Error Handling

### Goal
Replace fake estimates with actual data from new API endpoints. Add error handling and data validation.

### Deliverables

#### 2.1 Update API Types
**File:** `frontend/src/lib/types.ts`

Update `Conversation` interface:
```typescript
export interface Conversation {
  id: string
  projectName: string
  startTime: string
  lastActivity: string
  messageCount: number
  totalTokens: number      // NEW
  inputTokens: number      // NEW
  outputTokens: number     // NEW
  rootRequestId?: string
}
```

Add new types:
```typescript
export interface ConversationTokenSummary {
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

export interface TokenBreakdown {
  model: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  messageCount: number
}

export interface ProjectTokenStat {
  name: string
  totalTokens: number
  conversationCount: number
  topConversations: ConversationTokenBreakdown[]
}

export interface ConversationTokenBreakdown {
  conversationId: string
  totalTokens: number
  messageCount: number
}
```

#### 2.2 Add API Hooks
**File:** `frontend/src/lib/api.ts`

```typescript
export function useProjectTokenStats(params?: StatsParams) {
  const queryString = buildQueryString(params || {})
  return useQuery({
    queryKey: ['stats', 'projects', params],
    queryFn: () => fetchAPI<{ projects: ProjectTokenStat[] }>(
      `/stats/projects${queryString}`
    ),
  })
}
```

#### 2.3 Create ErrorBoundary Component
**File:** `frontend/src/components/ui/ErrorBoundary.tsx`

```typescript
import { Component, ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, retry: () => void) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  retry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error!, this.retry)
      ) : (
        <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded border border-red-200">
          <AlertCircle size={20} />
          <div className="flex-1">
            <p className="font-semibold">Something went wrong</p>
            <p className="text-sm">{this.state.error?.message}</p>
          </div>
          <button
            onClick={this.retry}
            className="p-2 hover:bg-red-100 rounded transition-colors"
            title="Try again"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

#### 2.4 Update TokenEconomics Page
**File:** `frontend/src/pages/TokenEconomics.tsx`

Remove all `* 1000` multipliers:

```typescript
// BEFORE:
const tokens = conv.messageCount * 1000  // WRONG
const model = 'Claude'                    // WRONG
const tokens: existing.tokens + tokens    // From project calculation

// AFTER:
const tokens = conv.totalTokens           // ACTUAL
const model = conv.model || 'Unknown'     // ACTUAL or placeholder
```

Update project stats to use API:
```typescript
const { data: projectStatsData } = useProjectTokenStats(dateRange)
const projectStats = useMemo(() => {
  return projectStatsData?.projects ?? []
}, [projectStatsData])
```

Update session data table:
```typescript
tokens: conv.totalTokens  // ACTUAL instead of conv.messageCount * 1000
```

Add data validation:
```typescript
function validateMetrics(metrics: any): string[] {
  const errors: string[] = []
  if (metrics.total < 0) errors.push('Total tokens cannot be negative')
  if (metrics.avgPerDay < 0) errors.push('Average per day cannot be negative')
  if (metrics.total > 1_000_000_000) errors.push('Total tokens suspiciously high (>1B)')
  return errors
}

const validationErrors = useMemo(
  () => validateMetrics(metrics),
  [metrics]
)

// Render warning if errors
{validationErrors.length > 0 && (
  <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
    <h3 className="font-semibold text-yellow-900 mb-2">Data Quality Notice</h3>
    <ul className="text-sm text-yellow-800">
      {validationErrors.map((error, i) => (
        <li key={i}>• {error}</li>
      ))}
    </ul>
  </div>
)}
```

Add error handling:
```typescript
const { data: weeklyStats, isLoading: isLoadingWeekly, error: weeklyError } = useWeeklyStats(dateRange)
const { data: conversations, isLoading: isLoadingConversations, error: convError } = useConversations()
const { data: projectStatsData, error: projectError } = useProjectTokenStats(dateRange)

if (weeklyError && !weeklyStats) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded">
      <p className="text-red-700 font-semibold">Failed to load token data</p>
      <p className="text-red-600 text-sm">{weeklyError.message}</p>
      <button onClick={() => window.location.reload()} className="mt-2 px-3 py-1 bg-red-700 text-white rounded">
        Retry
      </button>
    </div>
  )
}
```

### Implementation Order
1. Update API types in `types.ts`
2. Add `useProjectTokenStats()` hook in `api.ts`
3. Create `ErrorBoundary.tsx` component
4. Update `TokenEconomics.tsx` to use real data
5. Remove all `* 1000` multipliers
6. Add validation function and error handling
7. Test with real data

### Acceptance Criteria
- [ ] No `messageCount * 1000` anywhere in code
- [ ] Uses actual conversation token data from API
- [ ] Error handling works for API failures
- [ ] Data validation shows warnings for bad data
- [ ] All metrics display correctly
- [ ] No console errors

### Effort
4-6 hours

---

## Sprint 3: Testing & Data Validation

### Goal
Verify that all data is accurate and that the page works correctly with real token data.

### Deliverables

#### 3.1 Test Plan Document
**File:** `token-economics-testing-plan.md`

Document all test cases for:
- Functional testing (page loads, charts render, sorting works)
- Data accuracy (daily stats match conversations, projects match API)
- Error handling (API failures, missing data)

#### 3.2 Automated Unit Tests
**File:** `frontend/src/pages/TokenEconomics.test.tsx`

Test metric calculations, validation logic, error rendering:

```typescript
describe('TokenEconomics', () => {
  it('calculates total tokens from daily stats', () => {
    const dailyStats = [
      { date: '2026-01-20', tokens: 100000, requests: 10 },
      { date: '2026-01-21', tokens: 150000, requests: 15 },
    ]
    const total = dailyStats.reduce((sum, day) => sum + day.tokens, 0)
    expect(total).toBe(250000)
  })

  it('validates negative token counts', () => {
    const errors = validateMetrics({ total: -100, avgPerDay: 1000 })
    expect(errors).toContain('Total tokens cannot be negative')
  })

  it('renders error message on API failure', () => {
    const { getByText } = render(<TokenEconomicsPage />)
    expect(getByText(/failed to load/i)).toBeInTheDocument()
  })
})
```

Coverage target: >80%

#### 3.3 Integration Tests
**File:** `token-economics-integration.test.ts`

Test end-to-end data flow:

```typescript
describe('TokenEconomics Integration', () => {
  it('loads and displays data correctly', async () => {
    const { getByText } = render(<TokenEconomicsPage />)
    await waitFor(() => {
      expect(getByText(/token economics/i)).toBeInTheDocument()
    })
    expect(getByText(/100\.0k tokens/i)).toBeInTheDocument()
  })

  it('reconciles daily stats with conversation totals', async () => {
    // Verify sum(conversations) == sum(daily_stats)
  })

  it('retries on API failure', async () => {
    // Mock API failure, click retry, verify refetch
  })
})
```

#### 3.4 Data Validation Script
**File:** `scripts/validate-token-economics.js`

```javascript
#!/usr/bin/env node

async function validateTokenEconomics() {
  const errors = []

  // 1. Check no fake estimates exist
  console.log('Checking for fake estimates...')
  const hasEstimates = process.stdout.toString().includes('* 1000')
  if (hasEstimates) {
    errors.push('❌ Found token estimation (* 1000) in code')
  } else {
    console.log('✅ No token estimation found')
  }

  // 2. Verify daily stats match conversation totals
  console.log('\nVerifying daily stats vs conversations...')
  const dailyFromAPI = await fetch('/api/v2/stats').then(r => r.json())
  const convsFromAPI = await fetch('/api/v2/conversations').then(r => r.json())

  const dailyTotal = dailyFromAPI.dailyStats.reduce((s, d) => s + d.tokens, 0)
  const convTotal = convsFromAPI.reduce((s, c) => s + c.totalTokens, 0)

  if (Math.abs(dailyTotal - convTotal) > convTotal * 0.01) {
    errors.push(`❌ Daily total (${dailyTotal}) doesn't match conversation total (${convTotal})`)
  } else {
    console.log(`✅ Totals reconcile: ${dailyTotal} tokens`)
  }

  // 3. Verify project stats
  console.log('\nVerifying project stats...')
  const projectStats = await fetch('/api/v2/stats/projects').then(r => r.json())
  const projectTotal = projectStats.projects.reduce((s, p) => s + p.totalTokens, 0)

  if (Math.abs(projectTotal - dailyTotal) > dailyTotal * 0.01) {
    errors.push(`❌ Project total (${projectTotal}) doesn't match daily total (${dailyTotal})`)
  } else {
    console.log(`✅ Project stats reconcile: ${projectTotal} tokens`)
  }

  if (errors.length > 0) {
    console.error('\n❌ VALIDATION FAILED')
    errors.forEach(e => console.error(e))
    process.exit(1)
  } else {
    console.log('\n✅ ALL VALIDATIONS PASSED')
    process.exit(0)
  }
}

validateTokenEconomics().catch(e => {
  console.error('Validation error:', e)
  process.exit(1)
})
```

Run before deployment to verify no fake estimates and all data reconciles.

### Implementation Order
1. Write test plan document
2. Write automated unit tests
3. Write integration tests
4. Write validation script
5. Run all tests
6. Verify validation script passes

### Acceptance Criteria
- [ ] Test plan covers all scenarios
- [ ] >80% test coverage
- [ ] Integration tests pass
- [ ] Validation script passes (no fake estimates, data reconciles)
- [ ] All metrics match backend calculations

### Effort
4-6 hours

---

## Total Effort: 12-18 Hours

| Sprint | Task | Hours |
|--------|------|-------|
| 1 | Backend API endpoints | 4-6 |
| 2 | Frontend with real data + error handling | 4-6 |
| 3 | Testing & validation | 4-6 |
| **Total** | | **12-18** |

---

## Success Metrics

### Before
- ❌ Fake estimates: `messageCount * 1000`
- ❌ No error handling
- ❌ No data validation
- ❌ No tests
- ❌ Metrics don't match actual data

### After
- ✅ Zero instances of `messageCount * 1000`
- ✅ ErrorBoundary + error UI with retry
- ✅ Data validation with warning badges
- ✅ >80% test coverage
- ✅ All metrics reconcile with backend
- ✅ Data validation script passes

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Conversations with zero messages | Handle explicitly: return 0 tokens, not error |
| Model field is NULL | Use COALESCE(model, 'unknown') in SQL |
| Data integrity issues discovered in testing | Run validation script before testing |
| Type mismatches between backend & frontend | Keep types synchronized, test after each change |

---

## Dependencies

- None - all three sprints can execute sequentially
- Sprint 2 depends on Sprint 1
- Sprint 3 depends on Sprints 1 & 2
- No external services or third-party integrations needed

---

## Approval

**Ready to proceed:** YES

Next step: Begin Sprint 1 implementation
