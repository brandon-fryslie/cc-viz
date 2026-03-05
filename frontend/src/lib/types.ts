// TypeScript types matching Go models from proxy/internal/model/models.go

export interface AnthropicUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
  service_tier?: string
}

export interface RequestSummary {
  requestId: string
  timestamp: string
  method: string
  endpoint: string
  model?: string
  originalModel?: string
  routedModel?: string
  provider?: string
  subagentName?: string
  toolsUsed?: string[]
  toolCallCount?: number
  statusCode?: number
  responseTime?: number
  firstByteTime?: number
  usage?: AnthropicUsage
}

export interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: any
  tool_use_id?: string
  content?: string | AnthropicContentBlock[]
  is_error?: boolean
  source?: {
    type: string
    media_type: string
    data: string
  }
  [key: string]: any  // Index signature to allow any additional properties
}

export interface AnthropicMessage {
  role: string
  content: string | AnthropicContentBlock[]
}

export interface AnthropicSystemMessage {
  text: string
  type: string
  cache_control?: {
    type: string
  }
}

export interface Tool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export interface AnthropicRequest {
  model: string
  messages: AnthropicMessage[]
  max_tokens: number
  temperature?: number
  system?: AnthropicSystemMessage[]
  stream?: boolean
  tools?: Tool[]
  tool_choice?: any
}

export interface ResponseLog {
  statusCode: number
  headers: Record<string, string[]>
  body?: any
  bodyText?: string
  responseTime: number
  firstByteTime?: number
  streamingChunks?: string[]
  isStreaming: boolean
  completedAt: string
  toolCallCount?: number
}

export interface PromptGrade {
  score: number
  maxScore: number
  feedback: string
  improvedPrompt: string
  criteria: Record<string, {
    score: number
    feedback: string
  }>
  gradingTimestamp: string
  isProcessing: boolean
}

export interface RequestLog {
  requestId: string
  timestamp: string
  method: string
  endpoint: string
  headers: Record<string, string[]>
  body?: AnthropicRequest
  model?: string
  originalModel?: string
  routedModel?: string
  provider?: string
  subagentName?: string
  toolsUsed?: string[]
  toolCallCount?: number
  userAgent: string
  contentType: string
  promptGrade?: PromptGrade
  response?: ResponseLog
}

// Dashboard stats structures
export interface DailyTokens {
  date: string
  tokens: number
  requests: number
  models?: Record<string, ModelStats>
}

export interface HourlyTokens {
  hour: number
  tokens: number
  requests: number
  models?: Record<string, ModelStats>
}

export interface ModelStats {
  tokens: number
  requests: number
}

export interface ModelTokens {
  model: string
  tokens: number
  requests: number
}

export interface DashboardStats {
  dailyStats: DailyTokens[]
}

export interface HourlyStatsResponse {
  hourlyStats: HourlyTokens[]
  todayTokens: number
  todayRequests: number
  avgResponseTime: number
}

export interface ModelStatsResponse {
  modelStats: ModelTokens[]
}

// Provider analytics
export interface ProviderStats {
  provider: string
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  avgResponseMs: number
  errorCount: number
}

export interface ProviderStatsResponse {
  providers: ProviderStats[]
  startTime: string
  endTime: string
}

// Subagent analytics
export interface SubagentStats {
  subagentName: string
  provider: string
  targetModel: string
  requests: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  avgResponseMs: number
}

export interface SubagentStatsResponse {
  subagents: SubagentStats[]
  startTime: string
  endTime: string
}

// Tool analytics
export interface ToolStats {
  toolName: string
  usageCount: number
  callCount: number
  avgCallsPerRequest: number
}

export interface ToolStatsResponse {
  tools: ToolStats[]
  startTime: string
  endTime: string
}

// Performance analytics
export interface PerformanceStats {
  provider: string
  model: string
  avgResponseMs: number
  p50ResponseMs: number
  p95ResponseMs: number
  p99ResponseMs: number
  avgFirstByteMs: number
  requestCount: number
}

export interface PerformanceStatsResponse {
  stats: PerformanceStats[]
  startTime: string
  endTime: string
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Provider configuration - matches proxy/internal/config/config.go ProviderConfig
 */
export interface ProviderConfig {
  /** Provider format: "anthropic" or "openai" */
  format: 'anthropic' | 'openai'
  /** API base URL */
  base_url: string
  /** API key (will be "***REDACTED***" in responses from server) */
  api_key?: string
  /** API version (for Anthropic-format providers) */
  version?: string
  /** Max retry attempts */
  max_retries?: number
}

/**
 * Subagent routing configuration - matches proxy/internal/config/config.go SubagentsConfig
 */
export interface SubagentsConfig {
  /** Whether subagent routing is enabled */
  enable: boolean
  /** Mapping of agent name to "provider:model" string */
  mappings: Record<string, string>
}

/**
 * Server configuration - matches proxy/internal/config/config.go ServerConfig
 */
export interface ServerConfig {
  port: string
  timeouts: {
    read: string
    write: string
    idle: string
  }
}

/**
 * Storage configuration - matches proxy/internal/config/config.go StorageConfig
 */
export interface StorageConfig {
  requests_dir: string
  db_path: string
}

/**
 * Full configuration - matches proxy/internal/config/config.go Config
 */
export interface Config {
  server: ServerConfig
  providers: Record<string, ProviderConfig>
  storage: StorageConfig
  subagents: SubagentsConfig
}

// ============================================================================
// Routing Configuration Types (Phase 4.1)
// ============================================================================

/**
 * Circuit breaker configuration - matches proxy/internal/config/config.go CircuitBreakerConfig
 */
export interface CircuitBreakerConfig {
  enabled: boolean
  max_failures: number
  timeout: string
}

/**
 * Extended provider configuration including circuit breaker and fallback settings
 * Legacy routing config shape retained only as an internal DTO.
 */
export interface RoutingProviderConfig {
  format: 'anthropic' | 'openai'
  base_url: string
  max_retries: number
  fallback_provider?: string
  circuit_breaker: CircuitBreakerConfig
}

/**
 * Full routing configuration response
 * Legacy routing config shape retained only as an internal DTO.
 */
export interface RoutingConfig {
  providers: Record<string, RoutingProviderConfig>
  subagents: {
    enable: boolean
    mappings: Record<string, string>
  }
}

/**
 * Provider health status - matches proxy/internal/service/model_router.go ProviderHealth
 */
export interface ProviderHealth {
  name: string
  healthy: boolean
  circuit_breaker_state?: 'closed' | 'open' | 'half-open'
  fallback_provider?: string
}

/**
 * Routing statistics response
 * Legacy routing stats shape retained only as an internal DTO.
 */
export interface RoutingStatsResponse {
  providers: ProviderStatsResponse
  subagents: SubagentStatsResponse
  timeRange: {
    start: string
    end: string
  }
}

// ============================================================================
// Conversation Types
// ============================================================================

export interface Conversation {
  id: string
  projectName: string
  startTime: string
  lastActivity: string
  messageCount: number
  totalTokens: number      // NEW: actual token count from API
  inputTokens: number      // NEW: input token count
  outputTokens: number     // NEW: output token count
  rootRequestId?: string
}

// Token economics types
export interface TokenBreakdown {
  model: string
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  messageCount: number
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

export interface ConversationTokenBreakdown {
  conversationId: string
  totalTokens: number
  messageCount: number
}

export interface ProjectTokenStat {
  name: string
  totalTokens: number
  conversationCount: number
  topConversations: ConversationTokenBreakdown[]
}

export interface ProjectTokenStatsResponse {
  projects: ProjectTokenStat[]
}

// FTS5 search results
export interface ConversationMatch {
  conversationId: string
  projectName: string
  projectPath: string
  preview: string
  matchCount: number
  lastActivity: string
  highlightStart?: number
  highlightEnd?: number
}

export interface ConversationSearchResults {
  query: string
  results: ConversationMatch[]
  total: number
  limit: number
  offset: number
}

export interface RequestSearchResult {
  requestId: string
  timestamp: string
  method: string
  endpoint: string
  model: string
  provider: string
  matchCount: number
  snippet: string
  highlightStart?: number
  highlightEnd?: number
}

export interface RequestSearchResults {
  query: string
  results: RequestSearchResult[]
  total: number
  limit: number
  offset: number
}

// Claude Code log message format
export interface ClaudeCodeMessage {
  type: string  // 'user' | 'assistant' | 'file-history-snapshot' | 'queue-operation' | 'system'
  message?: {
    role?: string
    content?: string | AnthropicContentBlock[]
  } | null
  uuid: string
  timestamp: string
  parentUuid?: string | null
  isSidechain?: boolean
  userType?: string
  cwd?: string
  sessionId?: string
  version?: string
}

// Database message format - includes full message data
export interface DBConversationMessage {
  uuid: string
  conversationId: string
  parentUuid?: string
  type: string
  role?: string
  timestamp: string
  cwd?: string
  gitBranch?: string
  sessionId?: string
  agentId?: string
  isSidechain?: boolean
  requestId?: string
  model?: string
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  content?: any
}

export interface ConversationMessagesResponse {
  conversationId: string
  messages: DBConversationMessage[] | null
  total: number
  offset: number
  limit: number
}

export interface ConversationDetail {
  sessionId: string
  projectName: string
  projectPath: string
  startTime: string
  endTime: string
  messageCount: number
  messages: ClaudeCodeMessage[]
}

// ============================================================================
// Session Data Types (Todos & Plans)
// ============================================================================

export interface TodoStatusCounts {
  pending: number
  in_progress: number
  completed: number
}

export interface TodoSession {
  session_uuid: string
  agent_uuid: string
  file_path: string
  file_size: number
  todo_count: number
  pending_count: number
  in_progress_count: number
  completed_count: number
  modified_at: string
}

export interface TodosResponse {
  total_files: number
  non_empty_files: number
  status_breakdown: TodoStatusCounts
  sessions: TodoSession[]
  last_indexed: string
}

export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  active_form: string
}

export interface TodoDetailResponse {
  session_uuid: string
  agent_uuid: string
  file_path: string
  modified_at: string
  todos: TodoItem[]
}

export interface PlanSummary {
  id: number
  file_name: string
  display_name: string
  preview: string
  file_size: number
  modified_at: string
}

export interface PlansResponse {
  total_count: number
  total_size: number
  plans: PlanSummary[]
  last_indexed: string
}

export interface PlanDetailResponse {
  id: number
  file_name: string
  display_name: string
  content: string
  file_size: number
  modified_at: string
}

export interface Todo {
  id: number
  session_uuid: string
  agent_uuid?: string
  file_path: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  active_form?: string
  item_index: number
  modified_at: string
  indexed_at: string
  tags?: string
}

export interface Plan {
  id: number
  file_name: string
  display_name: string
  content: string
  preview: string
  file_size: number
  modified_at: string
  indexed_at: string
  session_uuid?: string
  goal?: string
  title?: string
  status?: string
}

export interface ReindexResponse {
  files_processed: number
  todos_indexed: number
  plans_indexed: number
  errors: string[]
  duration: string
}

// ============================================================================
// Extensions Hub Types
// ============================================================================

export type ExtensionType = 'agent' | 'command' | 'skill' | 'hook' | 'mcp'

export interface Extension {
  id: string
  type: ExtensionType
  name: string
  description: string
  enabled: boolean
  source: string  // "user", "{plugin}@{marketplace}", "project:{path}"
  plugin_id?: string
  marketplace_id?: string
  file_path: string
  project_path?: string
  metadata_json?: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface ComponentCounts {
  agents: number
  commands: number
  skills: number
  hooks: number
  mcp: number
}

export interface Plugin {
  id: string  // "{plugin}@{marketplace}"
  name: string
  marketplace: string
  version: string
  install_path: string
  component_counts: ComponentCounts
}

export interface Marketplace {
  id: string
  name: string
  source_type: string
  source_url: string
  last_updated: string
  auto_update: boolean
  plugin_count: number
  plugins?: Plugin[]
}

export interface ExtensionsResponse {
  extensions: Extension[]
  _total?: number
  _limit?: number
  _offset?: number
}

export interface PluginsResponse {
  plugins: Plugin[]
}

export interface MarketplacesResponse {
  marketplaces: Marketplace[]
}

// ============================================================================
// Unified Search Types (P7)
// ============================================================================

/**
 * Extension search result - lightweight version with snippet and highlights
 */
export interface ExtensionSearchResult {
  id: string
  type: string
  name: string
  source: string
  snippet: string
  highlightStart: number
  highlightEnd: number
  matchCount: number
  updatedAt?: string
}

/**
 * Todo search result - lightweight version with snippet and highlights
 */
export interface TodoSearchResult {
  id: number
  session_uuid: string
  snippet: string
  status: string
  highlightStart: number
  highlightEnd: number
  matchCount: number
  modifiedAt?: string
}

/**
 * Plan search result - lightweight version with snippet and highlights
 */
export interface PlanSearchResult {
  id: number
  file_name: string
  display_name: string
  snippet: string
  session_uuid?: string | null
  highlightStart: number
  highlightEnd: number
  matchCount: number
  modifiedAt?: string
}
