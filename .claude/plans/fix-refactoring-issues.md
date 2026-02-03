# Implementation Plan: Fix Post-Refactoring Issues

## Overview

This plan addresses 5 issues that arose from the recent refactoring to move cc-viz into its own project. After thorough investigation, I've identified the root causes and necessary fixes for each.

---

## Issue 1: /requests Page Shows No Data

### Root Cause
**Confidence: 90%**

The requests page data flow appears correct:
- Frontend calls `/api/v2/requests/summary` via `useRequestsSummary()` hook (api.ts:78-83)
- Backend handler `GetRequestsSummaryV2` (data_handler.go:588) queries the database
- Route is registered correctly (main.go:126)

Most likely cause: **No HAR files are being processed** because:
1. The queue directory may not contain files
2. The queue directory path may be misconfigured in config.yaml

### Verification Steps
1. Check if config.yaml exists and has correct `queue.directory` path
2. Check if the queue directory contains HAR files
3. Check database for existing request records

### Files to Modify
- None (likely configuration issue)

### Implementation
1. Verify config.yaml queue.directory setting points to cc-proxy output
2. If data exists in db but doesn't show, check browser network tab for API response
3. Add debug logging if needed to trace data flow

---

## Issue 2: Conversations Page - Scrolling and Full-Text Search

### Root Cause
**Confidence: 95%**

**Scrolling Issue:**
The `ConversationList` component (ConversationList.tsx:159-172) has a scrollable div but the parent container in `Conversations.tsx:250` doesn't properly constrain height:
```tsx
<div className="flex-1 overflow-hidden">  // Parent - has overflow-hidden
  <ConversationList ... />                 // Child - has overflow-y-auto on inner div
</div>
```

The inner div at line 160: `<div ref={listRef} className="overflow-y-auto">` lacks height constraint.

**Full-Text Search Issue:**
The frontend uses client-side filtering via `filterConversations()` (search.ts:99-129) which only searches:
- Cached conversation details (requires clicking each conversation first)
- Project names

The backend has a proper FTS5 search endpoint `/api/v2/conversations/search` (main.go:129) that's never called.

### Files to Modify
1. `frontend/src/components/features/ConversationList.tsx` - Add height constraint for scrolling
2. `frontend/src/pages/Conversations.tsx` - Integrate backend FTS search
3. `frontend/src/lib/api.ts` - Add search conversations hook

### Implementation

**Step 1: Fix scrolling (ConversationList.tsx:159-160)**
```tsx
// Change from:
<div ref={listRef} className="overflow-y-auto">

// To:
<div ref={listRef} className="h-full overflow-y-auto">
```

**Step 2: Add search API hook (api.ts)**
```tsx
export function useSearchConversations(query: string) {
  return useQuery({
    queryKey: ['conversations', 'search', query],
    queryFn: () => fetchAPI<SearchResult[]>(`/conversations/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2, // Only search with 2+ chars
  })
}
```

**Step 3: Update Conversations.tsx**
- When searchQuery is non-empty, call backend search endpoint
- Display search results instead of filtering client-side

---

## Issue 3: /session-data Page Not Loading Data

### Root Cause
**Confidence: 95%**

The SessionDataIndexer exists (session_data_indexer.go) but is **never started** at application startup in main.go.

Looking at main.go:
- Line 42-50: ConversationIndexer is started
- Line 54-63: SubagentIndexer is started
- **Missing**: SessionDataIndexer startup

The `ReindexTodosV2` handler (data_handler.go) creates an indexer on-demand but it's not running continuously.

### Files to Modify
1. `cmd/viz-server/main.go` - Add SessionDataIndexer startup

### Implementation

Add after subagent indexer startup (main.go, after line 63):

```go
// Start session data indexer
sessionDataIndexer, err := service.NewSessionDataIndexer(sqliteStorage)
if err != nil {
    logger.Fatalf("Failed to create session data indexer: %v", err)
}

// Initial index run
filesProcessed, todosIndexed, indexErrors := sessionDataIndexer.IndexTodos()
logger.Printf("Session data initial index: %d files, %d todos, %d errors", filesProcessed, todosIndexed, len(indexErrors))

plansProcessed, planErrors := sessionDataIndexer.IndexPlans()
logger.Printf("Plans initial index: %d files, %d errors", plansProcessed, len(planErrors))
```

Note: SessionDataIndexer doesn't have continuous watching (no Start/Stop methods like ConversationIndexer). We may want to add a periodic reindex or file watcher, but for now initial indexing plus manual reindex button will work.

---

## Issue 4: /plugins Page Shows 0 Components Until Clicking Extensions

### Root Cause
**Confidence: 95%**

The ExtensionIndexer exists (extension_indexer.go) but is **never run** at application startup. Extensions are only indexed when:
1. User clicks "Refresh" on extensions page
2. Triggers `/api/v2/claude/extensions/reindex` endpoint

The PluginView.tsx calls `useMarketplaces()` which fetches from `/api/v2/marketplaces`. Without initial indexing, the database tables are empty and `GetMarketplacesV2` returns 0 components.

### Files to Modify
1. `cmd/viz-server/main.go` - Add ExtensionIndexer startup

### Implementation

Add after session data indexer (main.go):

```go
// Index extensions at startup (non-blocking, warnings only)
extensionIndexer := service.NewExtensionIndexer(sqliteStorage)
if err := extensionIndexer.IndexExtensions(); err != nil {
    logger.Printf("Warning: Extension indexing failed: %v", err)
    // Don't fatal - extensions can be indexed on-demand via /reindex
} else {
    logger.Println("Extensions indexed")
}
```

---

## Issue 5: CLAUDE.md Memory Files Page Missing

### Root Cause
**Confidence: 100%**

The backend endpoint exists (`/api/v2/claude/config` → `GetClaudeConfigV2` at data_handler.go:981) but the frontend page is completely missing:
- No route in router.tsx
- No page component
- No sidebar entry

### Files to Modify
1. Create: `frontend/src/pages/ClaudeConfig.tsx` - New page component
2. `frontend/src/router.tsx` - Add route
3. `frontend/src/components/layout/Sidebar.tsx` - Add navigation item

### Implementation

**Step 1: Create ClaudeConfig.tsx**

```tsx
import { useState } from 'react'
import { AppLayout } from '@/components/layout'
import { useQuery } from '@tanstack/react-query'
import { Settings, FileText, Server, RefreshCw } from 'lucide-react'

interface ClaudeConfigResponse {
  settings?: {
    model?: string
    default_mode?: string
    permissions?: Record<string, string[]>
    plugins?: Record<string, unknown>
    raw?: unknown
  }
  settings_error?: string
  claude_md?: {
    content: string
    sections: Record<string, string>
  }
  claude_md_error?: string
  mcp_config?: {
    mcpServers?: Record<string, unknown>
  }
  mcp_config_error?: string
}

export function ClaudeConfigPage() {
  const [activeTab, setActiveTab] = useState<'claude_md' | 'settings' | 'mcp'>('claude_md')

  const { data, isLoading, refetch, isRefetching } = useQuery<ClaudeConfigResponse>({
    queryKey: ['claude-config'],
    queryFn: async () => {
      const response = await fetch('/api/v2/claude/config')
      if (!response.ok) throw new Error('Failed to fetch config')
      return response.json()
    }
  })

  // Tab content rendering with markdown display, JSON viewer, etc.
  // ... implementation details
}
```

**Step 2: Update router.tsx**

Add import and route:
```tsx
import { ClaudeConfigPage } from '@/pages/ClaudeConfig'

const claudeConfigRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/claude-config',
  component: ClaudeConfigPage,
})

// Add to routeTree
```

**Step 3: Update Sidebar.tsx**

Add to Configuration section:
```tsx
{ id: 'claude-config', label: 'Claude Config', icon: <FileText size={18} /> },
```

---

## Execution Order

1. **Issue 4** (Extensions) - Simple, single file change
2. **Issue 3** (Session Data) - Simple, single file change
3. **Issue 2** (Conversations) - Multiple files, moderate complexity
4. **Issue 5** (Claude Config Page) - New feature, multiple files
5. **Issue 1** (Requests) - Likely config verification, may need investigation

---

## Testing Plan

For each fix:

1. **Extensions/Plugins** - After restart, `/plugins` should show component counts without clicking `/extensions` first
2. **Session Data** - After restart, `/session-data` should show todos/plans immediately
3. **Conversations Scrolling** - Conversation list should scroll when list exceeds viewport
4. **Conversations Search** - Type search query, results should come from backend FTS (check network tab)
5. **Claude Config** - New `/claude-config` page shows CLAUDE.md, settings.json, .mcp.json content
6. **Requests** - Verify config.yaml, check database for data, trace API if needed

---

## Risk Assessment

- **Low Risk**: Issues 2, 3, 4, 5 - Clear root causes, straightforward fixes
- **Medium Risk**: Issue 1 - May require deeper investigation if config is correct

All fixes are backwards-compatible and don't change existing functionality, only add missing pieces.
