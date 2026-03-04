import { useQuery } from '@tanstack/react-query'

const API_BASE = '/api/v3'

async function fetchV3<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`v3 API error: ${response.status} ${message}`)
  }
  return response.json() as Promise<T>
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, String(value))
  })
  const encoded = search.toString()
  return encoded ? `?${encoded}` : ''
}

export interface OverviewResponse {
  generated_at: string
  kpis: {
    active_sessions: number
    total_sessions: number
    total_messages: number
    conversations_window: number
    total_tokens_window: number
    avg_tokens_per_session: number
  }
}

export interface MissionControlResponse {
  generated_at: string
  kpis: OverviewResponse['kpis']
  hot_sessions: Session[]
  health: {
    db_connected: boolean
    indexer_lag_seconds: number
  }
}

export interface ActivityEvent {
  id: string
  type: string
  timestamp: string
  title: string
  summary: string
  session_id?: string
  conversation_id?: string
  route: string
}

export interface Session {
  id: string
  project_path?: string
  started_at?: string
  ended_at?: string
  conversation_count: number
  message_count: number
  agent_count: number
  todo_count: number
  created_at: string
}

export interface SessionListResponse {
  sessions: Session[]
  total: number
  next_cursor?: string
}

export interface SessionDetailResponse {
  session: Session
  conversations: Array<{
    id: string
    projectName: string
    messageCount: number
    lastActivity: string
  }>
  files: Array<{
    id: number
    session_id: string
    file_path: string
    change_type: string
    tool_name?: string
    message_uuid?: string
    timestamp?: string
  }>
  plans: Array<{
    id: number
    file_name: string
    display_name: string
    content: string
    preview: string
    modified_at: string
    session_uuid?: string
  }>
  todos: Array<{
    id: number
    session_uuid: string
    agent_uuid?: string
    content: string
    status: string
    active_form?: string
    modified_at: string
  }>
}

export interface SessionMessagesResponse {
  session_id: string
  messages: Array<{
    uuid: string
    conversationId: string
    role?: string
    type: string
    timestamp: string
    content?: unknown
    model?: string
    agentId?: string
    inputTokens?: number
    outputTokens?: number
  }>
  total: number
  next_cursor?: string
}

export interface ConversationResponse {
  conversation: {
    sessionId: string
    projectPath: string
    projectName: string
    messages: Array<{
      uuid: string
      timestamp: string
      type: string
      message?: {
        role?: string
        content?: unknown
      }
      cwd?: string
      gitBranch?: string
      sessionId?: string
      agentId?: string
    }>
    startTime: string
    endTime: string
    messageCount: number
  }
  file_path: string
  project_path: string
}

export interface PlanResponse {
  id: number
  file_name: string
  display_name: string
  content: string
  preview: string
  modified_at: string
  session_uuid?: string
}

export interface TokenSummaryResponse {
  generated_at: string
  total_tokens: number
  burn_rate_per_day: number
  peak_day_tokens: number
  peak_day_date?: string
  trend_percent: number
}

export interface TokenTimeseriesResponse {
  bucket: string
  points: Array<{
    bucket: string
    tokens: number
    requests: number
  }>
}

export interface TokenProjectsResponse {
  projects: Array<{
    name: string
    totalTokens: number
    conversationCount: number
    topConversations: Array<{
      conversationId: string
      totalTokens: number
      messageCount: number
    }>
  }>
}

export interface ExtensionsConfigResponse {
  extensions: Array<{
    id: string
    type: string
    name: string
    description?: string
    enabled: boolean
    source: string
    plugin_id?: string
    marketplace_id?: string
    file_path: string
    metadata_json?: unknown
    updated_at?: string
  }>
  plugins: Array<{
    id: string
    name: string
    marketplace: string
    version: string
    component_counts: {
      agents: number
      commands: number
      skills: number
      hooks: number
      mcp: number
    }
  }>
  marketplaces: Array<{
    id: string
    name: string
    source_type: string
    source_url: string
    plugin_count: number
  }>
  config: Record<string, unknown>
  total: number
}

export interface SearchResponse {
  query: string
  sections: Record<string, { total: number; results: Array<Record<string, unknown>> }>
}

export function useV3Overview(params?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: ['v3', 'overview', params],
    queryFn: () => fetchV3<OverviewResponse>(`/overview${qs(params || {})}`),
  })
}

export function useV3MissionControl(params?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: ['v3', 'mission-control', params],
    queryFn: () => fetchV3<MissionControlResponse>(`/mission-control${qs(params || {})}`),
  })
}

export function useV3MissionActivity(limit = 50) {
  return useQuery({
    queryKey: ['v3', 'mission-activity', limit],
    queryFn: () => fetchV3<{ events: ActivityEvent[]; limit: number }>(`/mission-control/activity${qs({ limit })}`),
  })
}

export function useV3Sessions(params?: { limit?: number; cursor?: string; q?: string }) {
  return useQuery({
    queryKey: ['v3', 'sessions', params],
    queryFn: () => fetchV3<SessionListResponse>(`/sessions${qs(params || {})}`),
  })
}

export function useV3Session(sessionId: string | null) {
  return useQuery({
    queryKey: ['v3', 'session', sessionId],
    queryFn: () => fetchV3<SessionDetailResponse>(`/sessions/${sessionId}`),
    enabled: Boolean(sessionId),
  })
}

export function useV3SessionMessages(sessionId: string | null, params?: { limit?: number; cursor?: string }) {
  return useQuery({
    queryKey: ['v3', 'session-messages', sessionId, params],
    queryFn: () => fetchV3<SessionMessagesResponse>(`/sessions/${sessionId}/messages${qs(params || {})}`),
    enabled: Boolean(sessionId),
  })
}

export function useV3Conversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['v3', 'conversation', conversationId],
    queryFn: () => fetchV3<ConversationResponse>(`/conversations/${conversationId}`),
    enabled: Boolean(conversationId),
  })
}

export function useV3Plan(planId: string | null) {
  return useQuery({
    queryKey: ['v3', 'plan', planId],
    queryFn: () => fetchV3<PlanResponse>(`/plans/${planId}`),
    enabled: Boolean(planId),
  })
}

export function useV3TokenSummary(params?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: ['v3', 'token-summary', params],
    queryFn: () => fetchV3<TokenSummaryResponse>(`/token-economics/summary${qs(params || {})}`),
  })
}

export function useV3TokenTimeseries(params?: { start?: string; end?: string; bucket?: 'hour' | 'day' }) {
  return useQuery({
    queryKey: ['v3', 'token-timeseries', params],
    queryFn: () => fetchV3<TokenTimeseriesResponse>(`/token-economics/timeseries${qs(params || {})}`),
  })
}

export function useV3TokenProjects(params?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: ['v3', 'token-projects', params],
    queryFn: () => fetchV3<TokenProjectsResponse>(`/token-economics/projects${qs(params || {})}`),
  })
}

export function useV3ExtensionsConfig(params?: {
  type?: string
  source?: string
  enabled?: string
  plugin?: string
  q?: string
}) {
  return useQuery({
    queryKey: ['v3', 'extensions-config', params],
    queryFn: () => fetchV3<ExtensionsConfigResponse>(`/extensions-config${qs(params || {})}`),
  })
}

export function useV3ExtensionDetail(type: string | null, id: string | null) {
  return useQuery({
    queryKey: ['v3', 'extension-detail', type, id],
    queryFn: () => fetchV3<{ extension: ExtensionsConfigResponse['extensions'][number]; related: ExtensionsConfigResponse['extensions']; config: Record<string, unknown> }>(`/extensions-config/${type}/${id}`),
    enabled: Boolean(type && id),
  })
}

export function useV3Search(query: string, params?: { types?: string; limit?: number; offset?: number; enabled?: boolean }) {
  return useQuery({
    queryKey: ['v3', 'search', query, params],
    queryFn: () => fetchV3<SearchResponse>(`/search${qs({ q: query, types: params?.types, limit: params?.limit ?? 20, offset: params?.offset ?? 0 })}`),
    enabled: (params?.enabled ?? true) && query.trim().length >= 2,
    staleTime: 15_000,
  })
}

export async function reindexExtensionsV3(): Promise<{ status: string; message: string }> {
  return fetchV3<{ status: string; message: string }>('/extensions-config/reindex', { method: 'POST' })
}
