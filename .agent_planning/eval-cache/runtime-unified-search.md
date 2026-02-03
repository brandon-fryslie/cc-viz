# Runtime Behavior: Unified Search

**Last Updated**: 2026-01-19
**Scope**: Unified search API and snippet extraction

## What Works

### Backend Snippet Extraction
- `ExtractSnippet()` correctly extracts ~200 char context around search terms
- Case-insensitive matching works
- Ellipsis added at truncation boundaries ("..." prefix/suffix)
- Unicode handling correct (uses rune offsets internally, returns byte offsets)
- Highlight offsets are byte positions relative to snippet start
- Edge cases handled: empty text, term not found, empty query

### API Response Format
```json
{
  "query": "search-term",
  "conversations": {
    "results": [{
      "preview": "...text around match...",
      "highlightStart": 109,
      "highlightEnd": 114
    }]
  },
  "extensions": {
    "results": [{
      "snippet": "text around match...",
      "highlightStart": 28,
      "highlightEnd": 32
    }]
  }
}
```

### Search Types Working
1. **Conversations**: Preview field populated, highlights correct
2. **Extensions**: Snippet extraction from description field working
3. **Requests**: Structure correct (no test data to verify runtime)

## Known Issues

### Todos/Plans FTS5 Tables Empty
- **Symptom**: Search returns `"results": null, "total": 0`
- **Root cause**: FTS5 tables `todos_fts` and `plans_fts` have 0 rows
- **Data exists**: `claude_todos` table has data
- **Code is correct**: Backend search methods properly implemented
- **Fix needed**: Investigate `session_data_indexer.go` FTS5 triggers/inserts

## Testing Gaps
- Browser testing not performed for UI functionality
- Detail page highlighting not verified
- Navigation with ?q= param not tested
- Session UUID copy functionality not tested
