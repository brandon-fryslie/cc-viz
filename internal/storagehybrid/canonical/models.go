package canonical

import "time"

// [LAW:one-source-of-truth] Canonical tables are represented once here for schema ownership.

type Conversation struct {
	ID           string    `gorm:"primaryKey;column:id"`
	ProjectPath  string    `gorm:"column:project_path"`
	ProjectName  string    `gorm:"column:project_name"`
	StartTime    time.Time `gorm:"column:start_time"`
	EndTime      time.Time `gorm:"column:end_time"`
	MessageCount int       `gorm:"column:message_count"`
	FilePath     string    `gorm:"column:file_path"`
	FileMtime    time.Time `gorm:"column:file_mtime"`
	IndexedAt    time.Time `gorm:"column:indexed_at"`
}

func (Conversation) TableName() string { return "conversations" }

type ConversationMessage struct {
	UUID                string    `gorm:"primaryKey;column:uuid"`
	ConversationID      string    `gorm:"column:conversation_id"`
	ParentUUID          *string   `gorm:"column:parent_uuid"`
	Type                string    `gorm:"column:type"`
	Role                *string   `gorm:"column:role"`
	Timestamp           time.Time `gorm:"column:timestamp"`
	CWD                 *string   `gorm:"column:cwd"`
	GitBranch           *string   `gorm:"column:git_branch"`
	SessionID           *string   `gorm:"column:session_id"`
	AgentID             *string   `gorm:"column:agent_id"`
	IsSidechain         bool      `gorm:"column:is_sidechain"`
	RequestID           *string   `gorm:"column:request_id"`
	Model               *string   `gorm:"column:model"`
	InputTokens         int       `gorm:"column:input_tokens"`
	OutputTokens        int       `gorm:"column:output_tokens"`
	CacheReadTokens     int       `gorm:"column:cache_read_tokens"`
	CacheCreationTokens int       `gorm:"column:cache_creation_tokens"`
	ContentJSON         *string   `gorm:"column:content_json"`
	ToolUseJSON         *string   `gorm:"column:tool_use_json"`
	ToolResultJSON      *string   `gorm:"column:tool_result_json"`
}

func (ConversationMessage) TableName() string { return "conversation_messages" }

type Session struct {
	ID                string    `gorm:"primaryKey;column:id"`
	ProjectPath       string    `gorm:"column:project_path"`
	StartedAt         time.Time `gorm:"column:started_at"`
	EndedAt           time.Time `gorm:"column:ended_at"`
	ConversationCount int       `gorm:"column:conversation_count"`
	MessageCount      int       `gorm:"column:message_count"`
	AgentCount        int       `gorm:"column:agent_count"`
	TodoCount         int       `gorm:"column:todo_count"`
	CreatedAt         time.Time `gorm:"column:created_at"`
}

func (Session) TableName() string { return "sessions" }

type SessionConversationMap struct {
	ID               int       `gorm:"primaryKey;column:id"`
	SessionID        string    `gorm:"column:session_id"`
	ConversationID   string    `gorm:"column:conversation_id"`
	FirstMessageUUID *string   `gorm:"column:first_message_uuid"`
	LastMessageUUID  *string   `gorm:"column:last_message_uuid"`
	MessageCount     int       `gorm:"column:message_count"`
	CreatedAt        time.Time `gorm:"column:created_at"`
}

func (SessionConversationMap) TableName() string { return "session_conversation_map" }

type SessionFileChange struct {
	ID          int       `gorm:"primaryKey;column:id"`
	SessionID   string    `gorm:"column:session_id"`
	FilePath    string    `gorm:"column:file_path"`
	ChangeType  *string   `gorm:"column:change_type"`
	ToolName    *string   `gorm:"column:tool_name"`
	MessageUUID *string   `gorm:"column:message_uuid"`
	Timestamp   time.Time `gorm:"column:timestamp"`
	CreatedAt   time.Time `gorm:"column:created_at"`
}

func (SessionFileChange) TableName() string { return "session_file_changes" }

type PlanSessionMap struct {
	ID           int       `gorm:"primaryKey;column:id"`
	PlanID       int       `gorm:"column:plan_id"`
	SessionID    string    `gorm:"column:session_id"`
	Relationship *string   `gorm:"column:relationship"`
	Confidence   *string   `gorm:"column:confidence"`
	DiscoveredAt time.Time `gorm:"column:discovered_at"`
}

func (PlanSessionMap) TableName() string { return "plan_session_map" }

type Todo struct {
	ID          int       `gorm:"primaryKey;column:id"`
	SessionUUID string    `gorm:"column:session_uuid"`
	AgentUUID   *string   `gorm:"column:agent_uuid"`
	FilePath    string    `gorm:"column:file_path"`
	Content     string    `gorm:"column:content"`
	Status      string    `gorm:"column:status"`
	ActiveForm  *string   `gorm:"column:active_form"`
	ItemIndex   int       `gorm:"column:item_index"`
	ModifiedAt  time.Time `gorm:"column:modified_at"`
	IndexedAt   time.Time `gorm:"column:indexed_at"`
}

func (Todo) TableName() string { return "claude_todos" }

type TodoSession struct {
	ID              int       `gorm:"primaryKey;column:id"`
	SessionUUID     string    `gorm:"column:session_uuid"`
	AgentUUID       *string   `gorm:"column:agent_uuid"`
	FilePath        string    `gorm:"column:file_path"`
	FileSize        int64     `gorm:"column:file_size"`
	TodoCount       int       `gorm:"column:todo_count"`
	PendingCount    int       `gorm:"column:pending_count"`
	InProgressCount int       `gorm:"column:in_progress_count"`
	CompletedCount  int       `gorm:"column:completed_count"`
	ModifiedAt      time.Time `gorm:"column:modified_at"`
	IndexedAt       time.Time `gorm:"column:indexed_at"`
}

func (TodoSession) TableName() string { return "claude_todo_sessions" }

type Plan struct {
	ID          int       `gorm:"primaryKey;column:id"`
	FileName    string    `gorm:"column:file_name"`
	DisplayName string    `gorm:"column:display_name"`
	Content     string    `gorm:"column:content"`
	Preview     string    `gorm:"column:preview"`
	FileSize    int64     `gorm:"column:file_size"`
	ModifiedAt  time.Time `gorm:"column:modified_at"`
	IndexedAt   time.Time `gorm:"column:indexed_at"`
	SessionUUID *string   `gorm:"column:session_uuid"`
}

func (Plan) TableName() string { return "claude_plans" }

type Extension struct {
	ID            string    `gorm:"primaryKey;column:id"`
	Type          string    `gorm:"column:type"`
	Name          string    `gorm:"column:name"`
	Description   *string   `gorm:"column:description"`
	Enabled       bool      `gorm:"column:enabled"`
	Source        string    `gorm:"column:source"`
	PluginID      *string   `gorm:"column:plugin_id"`
	MarketplaceID *string   `gorm:"column:marketplace_id"`
	FilePath      string    `gorm:"column:file_path"`
	ProjectPath   *string   `gorm:"column:project_path"`
	MetadataJSON  *string   `gorm:"column:metadata_json"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

func (Extension) TableName() string { return "extensions" }

type SubagentGraphNode struct {
	ID               int       `gorm:"primaryKey;column:id"`
	SessionID        string    `gorm:"column:session_id"`
	ParentAgentID    *string   `gorm:"column:parent_agent_id"`
	AgentID          string    `gorm:"column:agent_id"`
	FirstMessageUUID *string   `gorm:"column:first_message_uuid"`
	LastMessageUUID  *string   `gorm:"column:last_message_uuid"`
	MessageCount     int       `gorm:"column:message_count"`
	SpawnTime        time.Time `gorm:"column:spawn_time"`
	EndTime          time.Time `gorm:"column:end_time"`
	Status           string    `gorm:"column:status"`
	IsSidechain      bool      `gorm:"column:is_sidechain"`
	FilePath         string    `gorm:"column:file_path"`
	FileMtime        time.Time `gorm:"column:file_mtime"`
	IndexedAt        time.Time `gorm:"column:indexed_at"`
}

func (SubagentGraphNode) TableName() string { return "subagent_graph" }
