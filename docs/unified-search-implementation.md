# Unified Contextual Search Bar - Implementation Summary

## What Was Implemented

A unified, persistent, non-modal search bar that replaces three disconnected search UIs (modal unified search, sidebar conversation search, and in-conversation message search).

## Architecture

### New Components

1. **`SearchContext.tsx`** - Search state management
   - Owns search query (synced with URL via nuqs `?q=`)
   - Auto-derives scope from current route
   - Manages keyboard shortcuts (Cmd+K, Cmd+Shift+K, /, Esc)
   - Single source of truth for search state

2. **`SearchBar.tsx`** - Persistent header search input
   - Located in root layout header
   - Shows current scope as a chip
   - Displays EverythingDropdown when scope is "Everything"

3. **`EverythingDropdown.tsx`** - Non-modal search results
   - Positioned absolutely below SearchBar
   - Shows unified results from all data types
   - Supports keyboard navigation (arrow keys, Enter)
   - Extracted from old UnifiedSearchModal

4. **`useUnifiedSearch.ts`** - API hook
   - Extracted from UnifiedSearchModal
   - Calls `/api/v2/search` endpoint
   - Returns results for all data types

### Search Scopes

- **Everything**: Cross-type search (triggered by Cmd+Shift+K)
- **Conversations**: FTS search on conversation list
- **This Session**: Client-side message filtering within a conversation
- **Requests**: FTS search on request list

Scope auto-derives from current route and can be overridden to "Everything".

### Modified Pages

1. **`Conversations.tsx`** - Now uses `useSearch()` context instead of local state
   - Removed ConversationSearch component from sidebar
   - Search query comes from global context

2. **`ConversationThread.tsx`** - Uses context for message filtering
   - Only filters when scope is 'this-session'
   - Removed local search state and toggle button

3. **`Requests.tsx`** - Uses context for request search
   - Removed inline search input
   - Search query comes from global context

### Deleted Files

- `UnifiedSearchModal.tsx` - Replaced by SearchBar + EverythingDropdown
- `ConversationSearch.tsx` - No longer needed (search is global)

## How It Works

1. **User types in global search bar** → Query synced to URL via nuqs
2. **Scope auto-derives from route**:
   - On `/conversations` → scope = "Conversations"
   - On `/conversations/$id` → scope = "This Session: {name}"
   - On `/requests` → scope = "Requests"
   - Elsewhere → scope = "Everything"
3. **Each page reads from context**:
   - ConversationsPage: Filters list via FTS when scope = "conversations"
   - ConversationThread: Filters messages client-side when scope = "this-session"
   - RequestsPage: Filters list via FTS when scope = "requests"
4. **Cmd+Shift+K overrides to Everything** → Shows dropdown with all results

## Keyboard Shortcuts

All managed by SearchContext (single enforcer):

- **Cmd+K** or **/**: Focus search bar (keeps current scope)
- **Cmd+Shift+K**: Open Everything search (override scope)
- **Esc**: Clear search, reset scope, blur input
- **↑↓ + Enter**: Navigate Everything dropdown results

## Benefits

1. **Single persistent interface** - No more switching between 3 different search UIs
2. **Context-aware** - Automatically scopes to current view
3. **Non-modal** - Page content stays visible while searching
4. **Keyboard-first** - Fast navigation with shortcuts
5. **URL-backed** - Search state persists in URL (via nuqs)

## Files Modified

### Created
- `src/lib/SearchContext.tsx`
- `src/lib/hooks/useUnifiedSearch.ts`
- `src/components/layout/SearchBar.tsx`
- `src/components/layout/EverythingDropdown.tsx`

### Modified
- `src/router.tsx` - Added SearchProvider, SearchBar to header
- `src/pages/Conversations.tsx` - Use global search context
- `src/components/features/ConversationThread.tsx` - Use global search context
- `src/pages/Requests.tsx` - Use global search context
- `src/components/layout/index.ts` - Export SearchBar

### Deleted
- `src/components/UnifiedSearchModal.tsx`
- `src/components/features/ConversationSearch.tsx`

## Testing

Run the dev server and verify:

```bash
just dev
```

1. **Type in search bar on `/conversations`** → List filters by FTS
2. **Click a conversation** → Scope changes to "This Session", messages highlight
3. **Click scope chip X** → Scope resets to Conversations
4. **Press Cmd+Shift+K** → Scope becomes Everything, dropdown shows results
5. **Click a result** → Navigates, scope auto-derives
6. **Press Esc** → Clears search, closes dropdown
7. **On `/requests`** → Type in search bar → Request list filters

## Future Enhancements (Not in Scope)

- Wiring secondary pages (SessionData, Extensions, TokenEconomics)
- Match navigation (prev/next arrows) within conversation messages
- Date filtering in the search bar (currently only in Everything scope)
