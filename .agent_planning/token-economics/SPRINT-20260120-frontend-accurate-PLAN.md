# Sprint: Frontend Accurate - Replace Estimates with Real Data

**Generated:** 2026-01-20
**Confidence:** HIGH
**Status:** READY FOR IMPLEMENTATION

## Sprint Goal

Replace the fake `messageCount * 1000` token estimation with actual data from the new API endpoints, add error handling, and polish UX for production readiness.

## Scope

**Deliverables:**

1. **Use real conversation token data** instead of estimation
   - Fetch actual tokens from new endpoint
   - Display inputTokens, outputTokens, totalTokens accurately
   - Remove all `* 1000` multipliers

2. **Implement error handling**
   - Error boundary component
   - Error state UI with retry button
   - Toast notifications for failures

3. **Add data validation**
   - Validate token counts are positive
   - Validate totals make sense
   - Show warning if data appears incomplete

## Work Items

### P0: Update API Types and Hooks

**File:** `frontend/src/lib/types.ts` + `frontend/src/lib/api.ts`

**Acceptance Criteria:**
- [ ] `Conversation` type updated to include: `totalTokens`, `inputTokens`, `outputTokens` fields
- [ ] New type: `ConversationTokenSummary` with all token breakdown fields
- [ ] New hook: `useConversationTokenSummary(conversationID)` fetches single conversation
- [ ] New hook: `useProjectTokenStats(dateRange)` fetches project breakdown
- [ ] Types match backend response structure exactly
- [ ] API errors properly typed as `Error | null`

**Type Definitions:**
```typescript
// types.ts
export interface Conversation {
  id: string
  projectName: string
  startTime: string
  lastActivity: string
  messageCount: number
  totalTokens: number          // NEW
  inputTokens: number          // NEW
  outputTokens: number         // NEW
  rootRequestId?: string
}

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

**API Hooks (api.ts):**
```typescript
export function useConversationTokenSummary(conversationId: string) {
  return useQuery({
    queryKey: ['conversation', conversationId, 'token-summary'],
    queryFn: () => fetchAPI<ConversationTokenSummary>(
      `/conversations/${conversationId}/token-summary`
    ),
    enabled: !!conversationId,
  })
}

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

**Technical Notes:**
- Ensure Conversation type is used by `useConversations()` automatically
- Use `enabled` flag to prevent fetching if conversationId is empty
- Handle API errors with try/catch in hooks

### P1: Error Boundary Component

**File:** `frontend/src/components/ui/ErrorBoundary.tsx` (new)

**Acceptance Criteria:**
- [ ] Catches React errors in wrapped component tree
- [ ] Displays error message with context
- [ ] Shows "Try Again" button that refreshes page (or resets state)
- [ ] Logs error to console for debugging
- [ ] Styled consistently with theme variables

**Implementation:**
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

**Technical Notes:**
- Use as wrapper: `<ErrorBoundary><TokenEconomicsPage /></ErrorBoundary>`
- Can customize fallback UI
- Should be used at page level, not component level

### P2: Update TokenEconomics Page - Remove Estimates

**File:** `frontend/src/pages/TokenEconomics.tsx`

**Acceptance Criteria:**
- [ ] Remove all `* 1000` multipliers
- [ ] Use actual `conversation.totalTokens` from API
- [ ] Display `inputTokens` and `outputTokens` separately (not combined)
- [ ] Remove comment about "rough estimate"
- [ ] Model field shows actual model (if available in conversation)
- [ ] Page renders without the fake data

**Changes:**
```typescript
// BEFORE:
const tokens = conv.messageCount * 1000  // WRONG
const model = 'Claude'                    // WRONG

// AFTER:
const tokens = conv.totalTokens           // ACTUAL
const model = conv.model || 'Unknown'     // ACTUAL or placeholder
```

**Project Stats Changes:**
```typescript
// BEFORE:
const projectStats = useMemo(() => {
  const projectMap = new Map<string, { tokens: number; requests: number }>()
  conversations.forEach((conv) => {
    const project = conv.projectName || 'Unknown'
    const tokens = conv.messageCount * 1000  // FAKE
    const existing = projectMap.get(project) || { tokens: 0, requests: 0 }
    projectMap.set(project, {
      tokens: existing.tokens + tokens,
      requests: existing.requests + 1,
    })
  })
  // ...
}, [conversations])

// AFTER:
const { data: projectStatsData } = useProjectTokenStats(dateRange)
const projectStats = useMemo(() => {
  return projectStatsData?.projects ?? []
}, [projectStatsData])
```

**Session Data Changes:**
```typescript
// BEFORE:
tokens: conv.messageCount * 1000  // FAKE

// AFTER:
tokens: conv.totalTokens          // ACTUAL
```

**Technical Notes:**
- Conversation type now includes totalTokens, so `conversation.totalTokens` works
- May need to fallback to 0 if tokens undefined: `conversation.totalTokens ?? 0`
- Remove the comment explaining the hack
- Session table now shows actual tokens per conversation

### P3: Add Data Validation and Warning Badges

**File:** `frontend/src/pages/TokenEconomics.tsx`

**Acceptance Criteria:**
- [ ] Validate that token totals are positive numbers
- [ ] Validate that conversation tokens <= daily totals (for consistency check)
- [ ] Show warning banner if data appears inconsistent
- [ ] Display "Last updated" timestamp
- [ ] Show warning icon if any metrics are estimated (if applicable)

**Implementation:**
```typescript
// Validation function
function validateMetrics(metrics: any): string[] {
  const errors: string[] = []
  if (metrics.total < 0) errors.push('Total tokens cannot be negative')
  if (metrics.avgPerDay < 0) errors.push('Average per day cannot be negative')
  if (metrics.total > 1_000_000_000) errors.push('Total tokens suspiciously high (>1B)')
  return errors
}

// In component:
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

// Show last updated
{weeklyStats && (
  <div className="text-xs text-[var(--color-text-muted)] mb-4">
    Last updated: {new Date(weeklyStats.lastUpdated).toLocaleTimeString()}
  </div>
)}
```

**Technical Notes:**
- Validation runs in useMemo so it's cached
- Only show warning if there are actual errors
- Add `lastUpdated` field to DashboardStats type if not present

### P4: Error Handling for API Failures

**File:** `frontend/src/pages/TokenEconomics.tsx`

**Acceptance Criteria:**
- [ ] Handle `error` state from hooks (weeklyStats, conversations, projectStats)
- [ ] Show error message if critical API fails
- [ ] Provide "Retry" button
- [ ] Don't crash page if API fails

**Implementation:**
```typescript
// Add error states from hooks
const { data: weeklyStats, isLoading: isLoadingWeekly, error: weeklyError } = useWeeklyStats(dateRange)
const { data: conversations, isLoading: isLoadingConversations, error: convError } = useConversations()
const { data: projectStatsData, error: projectError } = useProjectTokenStats(dateRange)

// Render error UI if critical API fails
if (weeklyError && !weeklyStats) {
  return (
    <ErrorAlert
      title="Failed to load token data"
      message={weeklyError.message}
      onRetry={() => refetch()}
    />
  )
}
```

**Technical Notes:**
- Use `error` from React Query hook
- Add generic `ErrorAlert` component if not exists

## Dependencies

- Depends on backend sprint being complete
  - New endpoints must exist: `/api/v2/conversations/{id}/token-summary`, `/api/v2/stats/projects`
  - Conversation type must include token fields
  - ProjectTokenStat endpoint must return correct JSON

## Risks

1. **API timing changes**
   - Conversations list now has expensive join to conversation_messages
   - Mitigation: Test performance with 10k+ conversations before deploying
   - May need to paginate conversations list

2. **Conversations without conversation_messages**
   - Some might not have indexed messages yet
   - Mitigation: Fall back to 0 tokens for such conversations
   - Validation: Show warning badge if token data incomplete

3. **Backward compatibility**
   - Frontend uses new token fields that didn't exist before
   - Mitigation: Ensure backend deploys before frontend
   - Validation: Test with old API endpoints (should fail gracefully)

## Testing Strategy

1. **Unit tests:**
   - Test `validateMetrics()` with edge cases (negative, too large, zero)
   - Test formatting with large numbers
   - Test ARIA labels render correctly

2. **Integration tests:**
   - Load page with real conversation data
   - Verify actual tokens match backend calculation
   - Verify project breakdown totals match daily stats
   - Test error states with mock API failures
   - Test date range changes fetch new data

3. **Manual testing:**
   - Load page in Chrome, Firefox, Safari
   - Test with screen reader (VoiceOver)
   - Test on mobile (iPad, iPhone)
   - Test with slow network (DevTools throttle)

---

## Implementation Order

1. Update API types (`Conversation`, `ConversationTokenSummary`, etc.)
2. Add API hooks (`useConversationTokenSummary`, `useProjectTokenStats`)
3. Add ErrorBoundary component
4. Update TokenEconomics page to remove `* 1000` multipliers
5. Add validation and warning badges
6. Add error handling for API failures

---

## Acceptance Criteria Summary

✅ No fake `messageCount * 1000` estimates anywhere
✅ Uses actual conversation token data from new API
✅ Proper error handling with user-friendly messages
✅ Data validation with warning badges
✅ All metrics reconcile with backend data

---

## Commit Message

```
feat(token-economics): use real data instead of estimates, add error handling

- Replace messageCount * 1000 estimates with actual conversation tokens
- Add error boundary and error handling UI
- Add data validation and warning badges
- Implement skeleton loaders for charts
- Add accessibility features (ARIA labels, semantic HTML)
- Update API hooks to fetch real token data from new endpoints
- Fixes data accuracy issues that made page unsuitable for paying customers

BREAKING: Conversation type now includes token fields
```
