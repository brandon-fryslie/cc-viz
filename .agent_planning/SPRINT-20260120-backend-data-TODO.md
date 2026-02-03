# Sprint 1 TODO - Token Economics Backend Data Endpoints

## Status: COMPLETED

### P0: Add ConversationTokenSummary Type
- [x] Add ConversationTokenSummary struct to models.go
- [x] Add TokenBreakdown struct to models.go
- [x] Add ProjectTokenStat struct to models.go
- [x] Add ConversationTokenBreakdown struct to models.go
- [x] Add IndexedConversationWithTokens struct to models.go

### P1: Update StorageService Interface
- [x] Add GetConversationTokenSummary() to StorageService interface
- [x] Add GetProjectTokenStats() to StorageService interface
- [x] Add GetIndexedConversationsWithTokens() to StorageService interface

### P2: Implement Storage Methods
- [x] Implement GetConversationTokenSummary() in SQLite storage
- [x] Implement GetProjectTokenStats() in SQLite storage
- [x] Implement GetIndexedConversationsWithTokens() in SQLite storage

### P3: Add API Handlers
- [x] Add GetConversationTokenSummaryV2() handler
- [x] Add GetProjectTokenStatsV2() handler
- [x] Add GetConversationsWithTokensV2() handler

### P4: Register Routes
- [x] Register /api/v2/conversations/{id}/token-summary
- [x] Register /api/v2/conversations/with-tokens
- [x] Register /api/v2/stats/projects

### P5: Verification
- [x] Run `go build` to verify compilation - SUCCESS

## Files Modified
- internal/model/models.go - Added token economics types
- internal/service/storage.go - Updated interface with new methods
- internal/service/storage_sqlite.go - Implemented storage methods
- internal/handler/data_handler.go - Added API handlers
- cmd/viz-server/main.go - Registered new routes

## New API Endpoints
1. GET /api/v2/conversations/{id}/token-summary - Token summary for a conversation
2. GET /api/v2/conversations/with-tokens - Conversations list with token data
3. GET /api/v2/stats/projects?start=...&end=... - Project-level token stats

## Next Steps
- Test endpoints with curl/Postman
- Update frontend types in lib/types.ts to match new API
- Implement Sprint 2 (Frontend Real Data + Error Handling)
