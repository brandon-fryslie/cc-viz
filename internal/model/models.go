package model

import (
	"encoding/json"
	"time"
)

type ContextKey string

const BodyBytesKey ContextKey = "bodyBytes"

type PromptGrade struct {
	Score            int                      `json:"score"`
	MaxScore         int                      `json:"maxScore"`
	Feedback         string                   `json:"feedback"`
	ImprovedPrompt   string                   `json:"improvedPrompt"`
	Criteria         map[string]CriteriaScore `json:"criteria"`
	GradingTimestamp string                   `json:"gradingTimestamp"`
	IsProcessing     bool                     `json:"isProcessing"`
}

type CriteriaScore struct {
	Score    int    `json:"score"`
	Feedback string `json:"feedback"`
}

type RequestLog struct {
	RequestID     string              `json:"requestId"`
	Timestamp     string              `json:"timestamp"`
	Method        string              `json:"method"`
	Endpoint      string              `json:"endpoint"`
	Headers       map[string][]string `json:"headers"`
	Body          interface{}         `json:"body"`
	Model         string              `json:"model,omitempty"`
	OriginalModel string              `json:"originalModel,omitempty"`
	RoutedModel   string              `json:"routedModel,omitempty"`
	Provider      string              `json:"provider,omitempty"`      // Which provider handled this request
	SubagentName  string              `json:"subagentName,omitempty"`  // Matched subagent definition name
	ToolsUsed     []string            `json:"toolsUsed,omitempty"`     // List of tool names from request
	ToolCallCount int                 `json:"toolCallCount,omitempty"` // Number of tool calls in response
	UserAgent     string              `json:"userAgent"`
	ContentType   string              `json:"contentType"`
	PromptGrade   *PromptGrade        `json:"promptGrade,omitempty"`
	Response      *ResponseLog        `json:"response,omitempty"`
}

// RequestSummary is a lightweight version of RequestLog for list views
type RequestSummary struct {
	RequestID     string          `json:"requestId"`
	Timestamp     string          `json:"timestamp"`
	Method        string          `json:"method"`
	Endpoint      string          `json:"endpoint"`
	Model         string          `json:"model,omitempty"`
	OriginalModel string          `json:"originalModel,omitempty"`
	RoutedModel   string          `json:"routedModel,omitempty"`
	Provider      string          `json:"provider,omitempty"`
	SubagentName  string          `json:"subagentName,omitempty"`
	ToolsUsed     []string        `json:"toolsUsed,omitempty"`
	ToolCallCount int             `json:"toolCallCount,omitempty"`
	StatusCode    int             `json:"statusCode,omitempty"`
	ResponseTime  int64           `json:"responseTime,omitempty"`
	FirstByteTime int64           `json:"firstByteTime,omitempty"` // Time to first token (streaming)
	Usage         *AnthropicUsage `json:"usage,omitempty"`
}

type ResponseLog struct {
	StatusCode      int                 `json:"statusCode"`
	Headers         map[string][]string `json:"headers"`
	Body            json.RawMessage     `json:"body,omitempty"`
	BodyText        string              `json:"bodyText,omitempty"`
	ResponseTime    int64               `json:"responseTime"`
	FirstByteTime   int64               `json:"firstByteTime,omitempty"` // Time to first token (streaming)
	StreamingChunks []string            `json:"streamingChunks,omitempty"`
	IsStreaming     bool                `json:"isStreaming"`
	CompletedAt     string              `json:"completedAt"`
	ToolCallCount   int                 `json:"toolCallCount,omitempty"` // Number of tool_use blocks in response
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompletionRequest struct {
	Model    string        `json:"model"`
	Messages []ChatMessage `json:"messages"`
	Stream   bool          `json:"stream,omitempty"`
}

type AnthropicUsage struct {
	InputTokens              int    `json:"input_tokens"`
	OutputTokens             int    `json:"output_tokens"`
	CacheCreationInputTokens int    `json:"cache_creation_input_tokens,omitempty"`
	CacheReadInputTokens     int    `json:"cache_read_input_tokens,omitempty"`
	ServiceTier              string `json:"service_tier,omitempty"`
}

type AnthropicResponse struct {
	Content      []AnthropicContentBlock `json:"content"`
	ID           string                  `json:"id"`
	Model        string                  `json:"model"`
	Role         string                  `json:"role"`
	StopReason   string                  `json:"stop_reason"`
	StopSequence *string                 `json:"stop_sequence"`
	Type         string                  `json:"type"`
	Usage        AnthropicUsage          `json:"usage"`
}

type AnthropicContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type AnthropicMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"`
}

func (m *AnthropicMessage) GetContentBlocks() []AnthropicContentBlock {
	switch v := m.Content.(type) {
	case string:
		return []AnthropicContentBlock{{Type: "text", Text: v}}
	case []interface{}:
		var blocks []AnthropicContentBlock
		for _, item := range v {
			if block, ok := item.(map[string]interface{}); ok {
				if typ, hasType := block["type"].(string); hasType {
					if text, hasText := block["text"].(string); hasText {
						blocks = append(blocks, AnthropicContentBlock{Type: typ, Text: text})
					}
				}
			}
		}
		return blocks
	case []AnthropicContentBlock:
		return v
	default:
		return []AnthropicContentBlock{}
	}
}

type AnthropicSystemMessage struct {
	Text         string        `json:"text"`
	Type         string        `json:"type"`
	CacheControl *CacheControl `json:"cache_control,omitempty"`
}

type CacheControl struct {
	Type string `json:"type"`
}

type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema InputSchema `json:"input_schema"`
}

type InputSchema struct {
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties"`
	Required   []string               `json:"required,omitempty"`
}

type AnthropicRequest struct {
	Model       string                   `json:"model"`
	Messages    []AnthropicMessage       `json:"messages"`
	MaxTokens   int                      `json:"max_tokens"`
	Temperature *float64                 `json:"temperature,omitempty"`
	System      []AnthropicSystemMessage `json:"system,omitempty"`
	Stream      bool                     `json:"stream,omitempty"`
	Tools       []Tool                   `json:"tools,omitempty"`
	ToolChoice  interface{}              `json:"tool_choice,omitempty"`
}

type ModelsResponse struct {
	Object string      `json:"object"`
	Data   []ModelInfo `json:"data"`
}

type ModelInfo struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

type GradeRequest struct {
	Messages       []AnthropicMessage       `json:"messages"`
	SystemMessages []AnthropicSystemMessage `json:"systemMessages"`
	RequestID      string                   `json:"requestId,omitempty"`
}

type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

type StreamingEvent struct {
	Type         string        `json:"type"`
	Index        *int          `json:"index,omitempty"`
	Delta        *Delta        `json:"delta,omitempty"`
	ContentBlock *ContentBlock `json:"content_block,omitempty"`
}

type Delta struct {
	Type  string          `json:"type,omitempty"`
	Text  string          `json:"text,omitempty"`
	Name  string          `json:"name,omitempty"`
	Input json.RawMessage `json:"input,omitempty"`
}

type ContentBlock struct {
	Type  string          `json:"type"`
	ID    string          `json:"id,omitempty"`
	Name  string          `json:"name,omitempty"`
	Input json.RawMessage `json:"input,omitempty"`
	Text  string          `json:"text,omitempty"`
}

// Dashboard stats structures
type DashboardStats struct {
	DailyStats []DailyTokens `json:"dailyStats"`
}

type HourlyStatsResponse struct {
	HourlyStats     []HourlyTokens `json:"hourlyStats"`
	TodayTokens     int64          `json:"todayTokens"`
	TodayRequests   int            `json:"todayRequests"`
	AvgResponseTime int64          `json:"avgResponseTime"`
}

type ModelStatsResponse struct {
	ModelStats []ModelTokens `json:"modelStats"`
}

type DailyTokens struct {
	Date     string                `json:"date"`
	Tokens   int64                 `json:"tokens"`
	Requests int                   `json:"requests"`
	Models   map[string]ModelStats `json:"models,omitempty"` // Per-model breakdown
}

type HourlyTokens struct {
	Hour     int                   `json:"hour"`
	Tokens   int64                 `json:"tokens"`
	Requests int                   `json:"requests"`
	Models   map[string]ModelStats `json:"models,omitempty"` // Per-model breakdown
}

type ModelStats struct {
	Tokens   int64 `json:"tokens"`
	Requests int   `json:"requests"`
}

type ModelTokens struct {
	Model    string `json:"model"`
	Tokens   int64  `json:"tokens"`
	Requests int    `json:"requests"`
}

// Provider analytics
type ProviderStats struct {
	Provider      string `json:"provider"`
	Requests      int    `json:"requests"`
	InputTokens   int64  `json:"inputTokens"`
	OutputTokens  int64  `json:"outputTokens"`
	TotalTokens   int64  `json:"totalTokens"`
	AvgResponseMs int64  `json:"avgResponseMs"`
	ErrorCount    int    `json:"errorCount"`
}

type ProviderStatsResponse struct {
	Providers []ProviderStats `json:"providers"`
	StartTime string          `json:"startTime"`
	EndTime   string          `json:"endTime"`
}

// Subagent analytics
type SubagentStats struct {
	SubagentName  string `json:"subagentName"`
	Provider      string `json:"provider"`
	TargetModel   string `json:"targetModel"`
	Requests      int    `json:"requests"`
	InputTokens   int64  `json:"inputTokens"`
	OutputTokens  int64  `json:"outputTokens"`
	TotalTokens   int64  `json:"totalTokens"`
	AvgResponseMs int64  `json:"avgResponseMs"`
}

type SubagentStatsResponse struct {
	Subagents []SubagentStats `json:"subagents"`
	StartTime string          `json:"startTime"`
	EndTime   string          `json:"endTime"`
}

// Tool analytics
type ToolStats struct {
	ToolName           string  `json:"toolName"`
	UsageCount         int     `json:"usageCount"` // How many requests included this tool
	CallCount          int     `json:"callCount"`  // How many times tool was called in responses
	AvgCallsPerRequest float64 `json:"avgCallsPerRequest"`
}

type ToolStatsResponse struct {
	Tools     []ToolStats `json:"tools"`
	StartTime string      `json:"startTime"`
	EndTime   string      `json:"endTime"`
}

// Performance analytics
type PerformanceStats struct {
	Provider       string `json:"provider"`
	Model          string `json:"model"`
	AvgResponseMs  int64  `json:"avgResponseMs"`
	P50ResponseMs  int64  `json:"p50ResponseMs"`
	P95ResponseMs  int64  `json:"p95ResponseMs"`
	P99ResponseMs  int64  `json:"p99ResponseMs"`
	AvgFirstByteMs int64  `json:"avgFirstByteMs"`
	RequestCount   int    `json:"requestCount"`
}

type PerformanceStatsResponse struct {
	Stats     []PerformanceStats `json:"stats"`
	StartTime string             `json:"startTime"`
	EndTime   string             `json:"endTime"`
}

// Conversation search types
type SearchOptions struct {
	Query       string
	ProjectPath string
	Limit       int
	Offset      int
	After       string // RFC3339 lower bound (inclusive)
	Before      string // RFC3339 upper bound (inclusive)
}

type SearchResults struct {
	Query   string               `json:"query"`
	Results []*ConversationMatch `json:"results"`
	Total   int                  `json:"total"`
	Limit   int                  `json:"limit"`
	Offset  int                  `json:"offset"`
}

type ConversationMatch struct {
	ConversationID string    `json:"conversationId"`
	ProjectName    string    `json:"projectName"`
	ProjectPath    string    `json:"projectPath"`
	Preview        string    `json:"preview"`
	MatchCount     int       `json:"matchCount"`
	LastActivity   time.Time `json:"lastActivity"`
	HighlightStart int       `json:"highlightStart,omitempty"`
	HighlightEnd   int       `json:"highlightEnd,omitempty"`
}

// RequestSearchResult represents a request search result with context
type RequestSearchResult struct {
	RequestID      string `json:"requestId"`
	Timestamp      string `json:"timestamp"`
	Method         string `json:"method"`
	Endpoint       string `json:"endpoint"`
	Model          string `json:"model"`
	Provider       string `json:"provider"`
	MatchCount     int    `json:"matchCount"`
	Snippet        string `json:"snippet"`
	HighlightStart int    `json:"highlightStart,omitempty"`
	HighlightEnd   int    `json:"highlightEnd,omitempty"`
}

// RequestSearchResults represents paginated request search results
type RequestSearchResults struct {
	Query   string                 `json:"query"`
	Results []*RequestSearchResult `json:"results"`
	Total   int                    `json:"total"`
	Limit   int                    `json:"limit"`
	Offset  int                    `json:"offset"`
}

// UnifiedSearchResults represents search results across all data types
type UnifiedSearchResults struct {
	Query         string                `json:"query"`
	Requests      *RequestSearchResults `json:"requests"`
	Conversations *SearchResults        `json:"conversations"`
	Extensions    UnifiedSearchSection  `json:"extensions"`
	Todos         UnifiedSearchSection  `json:"todos"`
	Plans         UnifiedSearchSection  `json:"plans"`
}

// UnifiedSearchSection represents results for a single data type in unified search
type UnifiedSearchSection struct {
	Results interface{} `json:"results"`
	Total   int         `json:"total"`
	Limit   int         `json:"limit"`
	Offset  int         `json:"offset"`
}

// ExtensionSearchResult represents a lightweight extension search result with snippet
type ExtensionSearchResult struct {
	ID             string `json:"id"`
	Type           string `json:"type"`
	Name           string `json:"name"`
	Source         string `json:"source"`
	Snippet        string `json:"snippet"`
	HighlightStart int    `json:"highlightStart"`
	HighlightEnd   int    `json:"highlightEnd"`
	MatchCount     int    `json:"matchCount"`
	UpdatedAt      string `json:"updatedAt,omitempty"`
}

// TodoSearchResult represents a lightweight todo search result with snippet
type TodoSearchResult struct {
	ID             int    `json:"id"`
	SessionUUID    string `json:"session_uuid"`
	Snippet        string `json:"snippet"`
	Status         string `json:"status"`
	HighlightStart int    `json:"highlightStart"`
	HighlightEnd   int    `json:"highlightEnd"`
	MatchCount     int    `json:"matchCount"`
	ModifiedAt     string `json:"modifiedAt,omitempty"`
}

// PlanSearchResult represents a lightweight plan search result with snippet
type PlanSearchResult struct {
	ID             int     `json:"id"`
	FileName       string  `json:"file_name"`
	DisplayName    string  `json:"display_name"`
	Snippet        string  `json:"snippet"`
	SessionUUID    *string `json:"session_uuid,omitempty"`
	HighlightStart int     `json:"highlightStart"`
	HighlightEnd   int     `json:"highlightEnd"`
	MatchCount     int     `json:"matchCount"`
	ModifiedAt     string  `json:"modifiedAt,omitempty"`
}

// IndexedConversation represents a conversation from the database index
type IndexedConversation struct {
	ID           string    `json:"id"`
	ProjectPath  string    `json:"projectPath"`
	ProjectName  string    `json:"projectName"`
	StartTime    time.Time `json:"startTime"`
	EndTime      time.Time `json:"lastActivity"`
	MessageCount int       `json:"messageCount"`
}

// DBConversationMessage represents a message stored in the database
type DBConversationMessage struct {
	UUID                  string          `json:"uuid"`
	ConversationID        string          `json:"conversationId"`
	ParentUUID            *string         `json:"parentUuid,omitempty"`
	Type                  string          `json:"type"`
	Role                  string          `json:"role,omitempty"`
	Timestamp             time.Time       `json:"timestamp"`
	CWD                   string          `json:"cwd,omitempty"`
	GitBranch             string          `json:"gitBranch,omitempty"`
	SessionID             string          `json:"sessionId,omitempty"`
	AgentID               string          `json:"agentId,omitempty"`
	IsSidechain           bool            `json:"isSidechain"`
	RequestID             string          `json:"requestId,omitempty"`
	Model                 string          `json:"model,omitempty"`
	InputTokens           int             `json:"inputTokens,omitempty"`
	OutputTokens          int             `json:"outputTokens,omitempty"`
	CacheReadTokens       int             `json:"cacheReadTokens,omitempty"`
	CacheCreationTokens   int             `json:"cacheCreationTokens,omitempty"`
	CacheCreation5mTokens int             `json:"cacheCreation5mTokens,omitempty"`
	CacheCreation1hTokens int             `json:"cacheCreation1hTokens,omitempty"`
	Content               json.RawMessage `json:"content,omitempty"`
}

// ConversationMessagesResponse wraps messages with pagination info
type ConversationMessagesResponse struct {
	ConversationID string                   `json:"conversationId"`
	Messages       []*DBConversationMessage `json:"messages"`
	Total          int                      `json:"total"`
	Offset         int                      `json:"offset"`
	Limit          int                      `json:"limit"`
}

// Extension types
type Extension struct {
	Type          string          `json:"type"`
	ID            string          `json:"id"`
	Name          string          `json:"name"`
	Description   string          `json:"description"`
	Enabled       bool            `json:"enabled"`
	Source        string          `json:"source"`                   // "user", "{plugin}@{marketplace}", "project:{path}"
	PluginID      *string         `json:"plugin_id,omitempty"`      // null for user/project extensions
	MarketplaceID *string         `json:"marketplace_id,omitempty"` // null for user/project extensions
	FilePath      string          `json:"file_path"`                // Full path to extension file
	ProjectPath   *string         `json:"project_path,omitempty"`   // null for user/plugin, path for project extensions
	MetadataJSON  json.RawMessage `json:"metadata_json,omitempty"`
	CreatedAt     time.Time       `json:"created_at,omitempty"`
	UpdatedAt     time.Time       `json:"updated_at,omitempty"`
}

type ExtensionStats struct {
	Total           int            `json:"total"`
	ByType          map[string]int `json:"by_type"`
	EnabledPlugins  []string       `json:"enabled_plugins"`
	DisabledPlugins []string       `json:"disabled_plugins"`
}

type ExtensionStatsResponse struct {
	Stats ExtensionStats `json:"stats"`
}

// Plugin and Marketplace types for Extensions Hub
type ComponentCounts struct {
	Agents   int `json:"agents"`
	Commands int `json:"commands"`
	Skills   int `json:"skills"`
	Hooks    int `json:"hooks"`
	MCP      int `json:"mcp"`
}

type Plugin struct {
	ID              string          `json:"id"`          // "{plugin}@{marketplace}"
	Name            string          `json:"name"`        // plugin name
	Marketplace     string          `json:"marketplace"` // marketplace ID
	Version         string          `json:"version"`
	InstallPath     string          `json:"install_path"`
	ComponentCounts ComponentCounts `json:"component_counts"`
}

type Marketplace struct {
	ID          string   `json:"id"`           // marketplace ID
	Name        string   `json:"name"`         // display name
	SourceType  string   `json:"source_type"`  // "git", etc.
	SourceURL   string   `json:"source_url"`   // repository URL
	LastUpdated string   `json:"last_updated"` // ISO timestamp
	AutoUpdate  bool     `json:"auto_update"`
	PluginCount int      `json:"plugin_count"`
	Plugins     []Plugin `json:"plugins,omitempty"` // Populated for hierarchy view
}

type PluginsResponse struct {
	Plugins []Plugin `json:"plugins"`
}

type MarketplacesResponse struct {
	Marketplaces []Marketplace `json:"marketplaces"`
}

type ExtensionsResponse struct {
	Extensions []*Extension `json:"extensions"`
}

// Subagent graph types - for hierarchy tracking
type SubagentGraphNode struct {
	ID               int        `json:"id"`
	SessionID        string     `json:"session_id"`
	ParentAgentID    *string    `json:"parent_agent_id"`
	AgentID          string     `json:"agent_id"`
	FirstMessageUUID string     `json:"first_message_uuid"`
	LastMessageUUID  string     `json:"last_message_uuid"`
	MessageCount     int        `json:"message_count"`
	SpawnTime        time.Time  `json:"spawn_time"`
	EndTime          *time.Time `json:"end_time,omitempty"`
	Status           string     `json:"status"`
	IsSidechain      bool       `json:"is_sidechain"`
}

// SubagentHierarchy represents a tree node in the agent spawn hierarchy
type SubagentHierarchy struct {
	Node     *SubagentGraphNode   `json:"node"`
	Children []*SubagentHierarchy `json:"children,omitempty"`
}

// SubagentGraphResponse is the API response for hierarchy queries
type SubagentGraphResponse struct {
	SessionID   string             `json:"session_id"`
	Hierarchy   *SubagentHierarchy `json:"hierarchy"`
	TotalAgents int                `json:"total_agents"`
	MaxDepth    int                `json:"max_depth"`
}

// SubagentGraphStats represents aggregate metrics about the subagent graph
type SubagentGraphStats struct {
	TotalSessions       int     `json:"total_sessions"`
	TotalAgents         int     `json:"total_agents"`
	TotalRootAgents     int     `json:"total_root_agents"`
	TotalSidechains     int     `json:"total_sidechains"`
	AvgAgentsPerSession float64 `json:"avg_agents_per_session"`
	MaxDepth            int     `json:"max_depth"`
}

// Session types - authoritative source for session tracking
type Session struct {
	ID                  string     `json:"id"`
	ProjectPath         string     `json:"project_path,omitempty"`
	StartedAt           *time.Time `json:"started_at,omitempty"`
	EndedAt             *time.Time `json:"ended_at,omitempty"`
	ConversationCount   int        `json:"conversation_count"`
	MessageCount        int        `json:"message_count"`
	AgentCount          int        `json:"agent_count"`
	TodoCount           int        `json:"todo_count"`
	TotalTokens         int64      `json:"total_tokens,omitempty"`
	InputTokens         int64      `json:"input_tokens,omitempty"`
	OutputTokens        int64      `json:"output_tokens,omitempty"`
	CacheReadTokens     int64      `json:"cache_read_tokens,omitempty"`
	CacheWriteTokens    int64      `json:"cache_creation_tokens,omitempty"`
	CacheHitRatePercent float64    `json:"cache_hit_rate_percent,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

type SessionStats struct {
	TotalSessions  int `json:"total_sessions"`
	ActiveSessions int `json:"active_sessions"` // Sessions with activity in last 24h
	TotalMessages  int `json:"total_messages"`
	UniqueProjects int `json:"unique_projects"`
}

// SessionConversationMap represents the junction table for session-conversation relationships
type SessionConversationMap struct {
	ID               int       `json:"id"`
	SessionID        string    `json:"session_id"`
	ConversationID   string    `json:"conversation_id"`
	FirstMessageUUID string    `json:"first_message_uuid,omitempty"`
	LastMessageUUID  string    `json:"last_message_uuid,omitempty"`
	MessageCount     int       `json:"message_count"`
	CreatedAt        time.Time `json:"created_at"`
}

// SessionFileChange represents a file that was modified during a session
type SessionFileChange struct {
	ID          int        `json:"id"`
	SessionID   string     `json:"session_id"`
	FilePath    string     `json:"file_path"`
	ChangeType  string     `json:"change_type"`
	ToolName    string     `json:"tool_name,omitempty"`
	MessageUUID string     `json:"message_uuid,omitempty"`
	Timestamp   *time.Time `json:"timestamp,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// Plan types - for ~/.claude/plans/*.md
type Plan struct {
	ID          int       `json:"id"`
	FileName    string    `json:"file_name"`
	DisplayName string    `json:"display_name"`
	Content     string    `json:"content"`
	Preview     string    `json:"preview"`
	FileSize    int64     `json:"file_size"`
	ModifiedAt  time.Time `json:"modified_at"`
	IndexedAt   time.Time `json:"indexed_at"`
	SessionUUID *string   `json:"session_uuid,omitempty"` // NEW - nullable
}

// PlanSessionMap represents the junction table for plan-session relationships
type PlanSessionMap struct {
	ID           int       `json:"id"`
	PlanID       int       `json:"plan_id"`
	SessionID    string    `json:"session_id"`
	Relationship string    `json:"relationship"` // 'created', 'referenced', 'updated'
	Confidence   string    `json:"confidence"`   // 'high' (UUID found), 'medium' (temporal match)
	DiscoveredAt time.Time `json:"discovered_at"`
}

// Todo types - for ~/.claude/todos/*.json
type Todo struct {
	ID          int       `json:"id"`
	SessionUUID string    `json:"session_uuid"`
	AgentUUID   string    `json:"agent_uuid,omitempty"`
	FilePath    string    `json:"file_path"`
	Content     string    `json:"content"`
	Status      string    `json:"status"` // 'pending', 'in_progress', 'completed'
	ActiveForm  string    `json:"active_form,omitempty"`
	ItemIndex   int       `json:"item_index"`
	ModifiedAt  time.Time `json:"modified_at"`
	IndexedAt   time.Time `json:"indexed_at"`
}

// Token Economics Types - for real token data from conversation_messages table
type ConversationTokenSummary struct {
	TotalTokens           int64                      `json:"totalTokens"`
	InputTokens           int64                      `json:"inputTokens"`
	OutputTokens          int64                      `json:"outputTokens"`
	CacheReadTokens       int64                      `json:"cacheReadTokens"`
	CacheCreationTokens   int64                      `json:"cacheCreationTokens"`
	CacheCreation5mTokens int64                      `json:"cacheCreation5mTokens"`
	CacheCreation1hTokens int64                      `json:"cacheCreation1hTokens"`
	MessageCount          int64                      `json:"messageCount"`
	AvgTokensPerMessage   int64                      `json:"avgTokensPerMessage"`
	CacheHitRatePercent   float64                    `json:"cacheHitRatePercent"`
	ByModel               map[string]*TokenBreakdown `json:"byModel"`
}

type TokenBreakdown struct {
	Model                 string `json:"model"`
	TotalTokens           int64  `json:"totalTokens"`
	InputTokens           int64  `json:"inputTokens"`
	OutputTokens          int64  `json:"outputTokens"`
	CacheReadTokens       int64  `json:"cacheReadTokens"`
	CacheCreationTokens   int64  `json:"cacheCreationTokens"`
	CacheCreation5mTokens int64  `json:"cacheCreation5mTokens"`
	CacheCreation1hTokens int64  `json:"cacheCreation1hTokens"`
	MessageCount          int64  `json:"messageCount"`
}

type ProjectTokenStat struct {
	Name                  string                       `json:"name"`
	TotalTokens           int64                        `json:"totalTokens"`
	InputTokens           int64                        `json:"inputTokens"`
	OutputTokens          int64                        `json:"outputTokens"`
	CacheReadTokens       int64                        `json:"cacheReadTokens"`
	CacheCreationTokens   int64                        `json:"cacheCreationTokens"`
	CacheCreation5mTokens int64                        `json:"cacheCreation5mTokens"`
	CacheCreation1hTokens int64                        `json:"cacheCreation1hTokens"`
	CacheHitRatePercent   float64                      `json:"cacheHitRatePercent"`
	ConversationCount     int64                        `json:"conversationCount"`
	TopConversations      []ConversationTokenBreakdown `json:"topConversations"`
}

type ConversationTokenBreakdown struct {
	ConversationID      string  `json:"conversationId"`
	TotalTokens         int64   `json:"totalTokens"`
	InputTokens         int64   `json:"inputTokens"`
	OutputTokens        int64   `json:"outputTokens"`
	CacheReadTokens     int64   `json:"cacheReadTokens"`
	CacheCreationTokens int64   `json:"cacheCreationTokens"`
	CacheHitRatePercent float64 `json:"cacheHitRatePercent"`
	MessageCount        int64   `json:"messageCount"`
}

// IndexedConversationWithTokens extends IndexedConversation with token fields
type IndexedConversationWithTokens struct {
	ID                    string    `json:"id"`
	ProjectPath           string    `json:"projectPath"`
	ProjectName           string    `json:"projectName"`
	StartTime             time.Time `json:"startTime"`
	EndTime               time.Time `json:"lastActivity"`
	MessageCount          int       `json:"messageCount"`
	TotalTokens           int64     `json:"totalTokens"`
	InputTokens           int64     `json:"inputTokens"`
	OutputTokens          int64     `json:"outputTokens"`
	CacheReadTokens       int64     `json:"cacheReadTokens"`
	CacheCreationTokens   int64     `json:"cacheCreationTokens"`
	CacheCreation5mTokens int64     `json:"cacheCreation5mTokens"`
	CacheCreation1hTokens int64     `json:"cacheCreation1hTokens"`
	CacheHitRatePercent   float64   `json:"cacheHitRatePercent"`
}

type V3TokenUsageBreakdown struct {
	TotalTokens           int64 `json:"total_tokens"`
	InputTokens           int64 `json:"input_tokens"`
	OutputTokens          int64 `json:"output_tokens"`
	CacheReadTokens       int64 `json:"cache_read_input_tokens"`
	CacheCreationTokens   int64 `json:"cache_creation_input_tokens"`
	CacheCreation5mTokens int64 `json:"cache_creation_5m_input_tokens,omitempty"`
	CacheCreation1hTokens int64 `json:"cache_creation_1h_input_tokens,omitempty"`
}

type V3PromptCacheMetrics struct {
	CacheHitRatePercent   float64 `json:"cache_hit_rate_percent"`
	CacheWriteRatePercent float64 `json:"cache_write_rate_percent"`
	UncachedInputTokens   int64   `json:"uncached_input_tokens"`
}

// V3OverviewResponse is the compact landing payload for the rebuilt Mantine UI.
type V3OverviewResponse struct {
	GeneratedAt string        `json:"generated_at"`
	KPIs        V3OverviewKPI `json:"kpis"`
}

type V3OverviewKPI struct {
	ActiveSessions      int   `json:"active_sessions"`
	TotalSessions       int   `json:"total_sessions"`
	TotalMessages       int   `json:"total_messages"`
	ConversationsWindow int   `json:"conversations_window"`
	TotalTokensWindow   int64 `json:"total_tokens_window"`
	AvgTokensPerSession int64 `json:"avg_tokens_per_session"`
}

type V3MissionControlResponse struct {
	GeneratedAt string          `json:"generated_at"`
	KPIs        V3OverviewKPI   `json:"kpis"`
	HotSessions []*Session      `json:"hot_sessions"`
	Health      V3MissionHealth `json:"health"`
}

type V3MissionHealth struct {
	DBConnected bool  `json:"db_connected"`
	IndexerLag  int64 `json:"indexer_lag_seconds"`
}

type V3ActivityEvent struct {
	ID             string `json:"id"`
	Type           string `json:"type"`
	Timestamp      string `json:"timestamp"`
	Title          string `json:"title"`
	Summary        string `json:"summary"`
	SessionID      string `json:"session_id,omitempty"`
	ConversationID string `json:"conversation_id,omitempty"`
	Route          string `json:"route"`
}

type V3ActivityResponse struct {
	Events []*V3ActivityEvent `json:"events"`
	Limit  int                `json:"limit"`
}

type V3SessionsResponse struct {
	Sessions   []*Session `json:"sessions"`
	Total      int        `json:"total"`
	NextCursor string     `json:"next_cursor,omitempty"`
}

type V3TokenSummaryResponse struct {
	GeneratedAt    string                `json:"generated_at"`
	TotalTokens    int64                 `json:"total_tokens"`
	BurnRatePerDay int64                 `json:"burn_rate_per_day"`
	PeakDayTokens  int64                 `json:"peak_day_tokens"`
	PeakDayDate    string                `json:"peak_day_date,omitempty"`
	TrendPercent   int64                 `json:"trend_percent"`
	Usage          V3TokenUsageBreakdown `json:"usage"`
	PromptCache    V3PromptCacheMetrics  `json:"prompt_cache"`
}

type V3TokenTimeseriesPoint struct {
	Bucket              string  `json:"bucket"`
	Tokens              int64   `json:"tokens"`
	Requests            int     `json:"requests"`
	InputTokens         int64   `json:"input_tokens"`
	OutputTokens        int64   `json:"output_tokens"`
	CacheReadTokens     int64   `json:"cache_read_input_tokens"`
	CacheCreationTokens int64   `json:"cache_creation_input_tokens"`
	CacheHitRatePercent float64 `json:"cache_hit_rate_percent"`
}

type V3TokenTimeseriesResponse struct {
	Bucket string                    `json:"bucket"`
	Points []*V3TokenTimeseriesPoint `json:"points"`
}

type V3ExtensionsConfigResponse struct {
	Extensions   []*Extension           `json:"extensions"`
	Plugins      []Plugin               `json:"plugins"`
	Marketplaces []Marketplace          `json:"marketplaces"`
	Config       map[string]interface{} `json:"config"`
	Total        int                    `json:"total"`
}

type V3SearchResponse struct {
	Query    string                   `json:"query"`
	Sections map[string]V3SearchChunk `json:"sections"`
}

type V3SearchChunk struct {
	Total   int           `json:"total"`
	Results []interface{} `json:"results"`
}

type V3LiveClientMessage struct {
	Op     string   `json:"op"`
	Topics []string `json:"topics,omitempty"`
	TS     string   `json:"ts,omitempty"`
}

type V3LiveServerMessage struct {
	Op         string      `json:"op"`
	ServerTime string      `json:"server_time,omitempty"`
	Topics     []string    `json:"topics,omitempty"`
	Topic      string      `json:"topic,omitempty"`
	Event      string      `json:"event,omitempty"`
	Seq        int64       `json:"seq,omitempty"`
	TS         string      `json:"ts,omitempty"`
	Data       interface{} `json:"data,omitempty"`
	Code       string      `json:"code,omitempty"`
	Message    string      `json:"message,omitempty"`
}
