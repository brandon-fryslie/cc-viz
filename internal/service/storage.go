package service

import (
	"github.com/brandon-fryslie/cc-viz/internal/model"
)

// RuntimeStorageService is the storage contract required by the current runtime router.
// [LAW:locality-or-seam] Keep runtime endpoints decoupled from legacy request ingestion APIs.
type RuntimeStorageService interface {
	// Core lifecycle
	Close() error

	// Dashboard analytics
	GetStats(startDate, endDate string) (*model.DashboardStats, error)
	GetHourlyStats(startTime, endTime string) (*model.HourlyStatsResponse, error)
	GetModelStats(startTime, endTime string) (*model.ModelStatsResponse, error)

	// Conversation search
	SearchConversations(opts model.SearchOptions) (*model.SearchResults, error)
	SearchExtensions(query string, extType, source string, limit, offset int, after, before string) ([]*model.ExtensionSearchResult, int, error)
	SearchTodos(query, status string, limit, offset int, after, before string) ([]*model.TodoSearchResult, int, error)
	SearchPlans(query, status string, limit, offset int, after, before string) ([]*model.PlanSearchResult, int, error)
	SearchUnified(query string, dataTypes []string, limit, offset int, after, before string) (*model.UnifiedSearchResults, error)

	// Indexed conversations - fast database lookup
	GetIndexedConversations(limit int) ([]*model.IndexedConversation, error)

	// GetConversationFilePath returns the file path and project path for a conversation by ID
	GetConversationFilePath(conversationID string) (filePath string, projectPath string, err error)

	// GetConversationMessages returns messages for a conversation from the database
	GetConversationMessages(conversationID string, limit, offset int) ([]*model.DBConversationMessage, int, error)

	// GetConversationMessagesWithSubagents returns messages including subagent messages merged by timestamp
	GetConversationMessagesWithSubagents(conversationID string, limit, offset int) ([]*model.DBConversationMessage, int, error)

	// ReindexConversations triggers a full re-index of all conversations
	ReindexConversations() error

	// Extension management (updated for Extensions Hub)
	GetExtensionsFiltered(extType, source, search string) ([]*model.Extension, error)
	GetExtensions(extType string) ([]*model.Extension, error)
	GetExtension(extType, id string) (*model.Extension, error)
	UpdateExtensionEnabled(id string, enabled bool) error
	GetExtensionStats() (*model.ExtensionStatsResponse, error)
	SaveExtension(ext *model.Extension) error
	DeleteExtension(id string) error

	// Plugin and Marketplace management
	GetPlugins() ([]model.Plugin, error)
	GetPlugin(pluginID string) (*model.Plugin, error)
	GetMarketplaces() ([]model.Marketplace, error)

	// Subagent graph methods
	GetSubagentHierarchy(sessionID string) (*model.SubagentGraphResponse, error)
	GetSubagentGraphStats() (*model.SubagentGraphStats, error)
	GetSubagentGraphAgent(sessionID, agentID string) (*model.SubagentGraphNode, error)

	// Session management
	GetSessions(limit, offset int) ([]*model.Session, error)
	GetSession(sessionID string) (*model.Session, error)
	GetSessionStats() (*model.SessionStats, error)

	// Relationship mapping - Session-Conversation relationships
	GetSessionConversations(sessionID string) ([]*model.IndexedConversation, error)
	GetConversationSessions(conversationID string) ([]*model.Session, error)

	// Relationship mapping - Session-File relationships
	GetSessionFileChanges(sessionID string) ([]*model.SessionFileChange, error)
	GetFileChangeSessions(filePath string) ([]*model.Session, error)
	SaveFileChange(change *model.SessionFileChange) error

	// Relationship mapping - Plan-Session relationships
	GetPlanSessions(planID int) ([]*model.Session, error)
	GetSessionPlans(sessionID string) ([]*model.Plan, error)
	LinkPlanToSession(planID int, sessionID string, relationship string, confidence string) error

	// Todos - for session detail
	GetTodosBySession(sessionID string) ([]*model.Todo, error)

	// Plans - get all plans
	GetAllPlans() ([]*model.Plan, error)
	GetAllSessionIDs() ([]string, error)

	// Token Economics - real token data from conversation_messages
	GetConversationTokenSummary(conversationID string) (*model.ConversationTokenSummary, error)
	GetProjectTokenStats(startTime, endTime string) ([]*model.ProjectTokenStat, error)
	GetIndexedConversationsWithTokens(limit int) ([]*model.IndexedConversationWithTokens, error)
}
