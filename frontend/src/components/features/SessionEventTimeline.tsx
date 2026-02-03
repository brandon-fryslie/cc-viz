import { useState, useMemo, useCallback } from 'react'
import { Rocket, MessageSquare, CheckCircle, FileText, ArrowLeft, ArrowRight } from 'lucide-react'
import { useConversationMessages, useTodos, usePlans } from '@/lib/api'
import type { DBConversationMessage, Todo, PlanSummary } from '@/lib/types'
import { Timeline, type TimelineEvent } from '@/components/ui/Timeline'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface SessionEventTimelineProps {
  sessionUuid?: string
}

interface EventFilter {
  conversations: boolean
  todos: boolean
  plans: boolean
}

/**
 * SessionEventTimeline - Gorgeous central timeline showing all session events
 *
 * Features:
 * - Interleaved events from conversations, todos, and plans
 * - Expandable event cards with smooth animations
 * - Search and filtering
 * - Navigation between search matches
 * - Beautiful icons and styling
 */
export function SessionEventTimeline({ sessionUuid }: SessionEventTimelineProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<EventFilter>({
    conversations: true,
    todos: true,
    plans: true,
  })
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

  // Fetch data
  const { data: messagesResponse, isLoading: isLoadingMessages } = useConversationMessages(
    sessionUuid || null,
    { includeSubagents: true }
  )
  const { data: todosResponse, isLoading: isLoadingTodos } = useTodos()
  const { data: plansResponse, isLoading: isLoadingPlans } = usePlans()

  // Extract session-specific todos
  const sessionTodos = useMemo(() => {
    if (!todosResponse || !sessionUuid) return []

    const session = todosResponse.sessions.find((s) => s.session_uuid === sessionUuid)
    if (!session) return []

    // Since we don't have individual todos here, we'll need to fetch them separately
    // For now, return empty array - in real implementation, use useTodoDetail
    return []
  }, [todosResponse, sessionUuid])

  // Extract session-specific plans (PlanSummary doesn't have session_uuid, so show all for now)
  const sessionPlans = useMemo(() => {
    if (!plansResponse || !sessionUuid) return []

    // PlanSummary doesn't include session_uuid - return empty for now
    // In a full implementation, we'd need usePlanDetail or a new API endpoint
    return [] as PlanSummary[]
  }, [plansResponse, sessionUuid])

  // Convert data to timeline events
  const allEvents = useMemo(() => {
    if (!sessionUuid) return []

    const events: TimelineEvent[] = []

    // Add session start event
    if (messagesResponse?.messages && messagesResponse.messages.length > 0) {
      const firstMessage = messagesResponse.messages[0]
      events.push({
        id: `session-start-${sessionUuid}`,
        timestamp: firstMessage.timestamp,
        title: 'Session started',
        type: 'session-start',
        icon: <Rocket className="w-4 h-4" />,
        description: `Started in ${firstMessage.cwd || 'unknown directory'}`,
      })
    }

    // Add conversation messages
    if (filters.conversations && messagesResponse?.messages) {
      messagesResponse.messages.forEach((msg) => {
        const contentPreview = getMessagePreview(msg)
        if (contentPreview) {
          events.push({
            id: `msg-${msg.uuid}`,
            timestamp: msg.timestamp,
            title: `${msg.role || msg.type} message`,
            type: 'conversation',
            icon: <MessageSquare className="w-4 h-4" />,
            description: contentPreview,
            details: <ConversationEventDetails message={msg} />,
          })
        }
      })
    }

    // Add todos
    if (filters.todos && sessionTodos.length > 0) {
      sessionTodos.forEach((todo: any) => {
        events.push({
          id: `todo-${todo.id}`,
          timestamp: todo.modified_at,
          title: 'Todo',
          type: 'todo',
          icon: <CheckCircle className="w-4 h-4" />,
          description: todo.content.slice(0, 100),
          details: <TodoEventDetails todo={todo} />,
        })
      })
    }

    // Add plans
    if (filters.plans && sessionPlans.length > 0) {
      sessionPlans.forEach((plan) => {
        events.push({
          id: `plan-${plan.id}`,
          timestamp: plan.modified_at,
          title: 'Plan created',
          type: 'plan',
          icon: <FileText className="w-4 h-4" />,
          description: plan.display_name,
          details: <PlanEventDetails plan={plan as PlanSummary} />,
        })
      })
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return events
  }, [sessionUuid, messagesResponse, filters, sessionTodos, sessionPlans])

  // Filter events by search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return allEvents

    const query = searchQuery.toLowerCase()
    return allEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query)
    )
  }, [allEvents, searchQuery])

  // Search match navigation
  const searchMatches = useMemo(() => {
    if (!searchQuery) return []
    return filteredEvents.map((e) => e.id)
  }, [searchQuery, filteredEvents])

  const handlePrevMatch = useCallback(() => {
    if (searchMatches.length === 0) return
    setCurrentMatchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length)
  }, [searchMatches.length])

  const handleNextMatch = useCallback(() => {
    if (searchMatches.length === 0) return
    setCurrentMatchIndex((prev) => (prev + 1) % searchMatches.length)
  }, [searchMatches.length])

  // Toggle filter
  const toggleFilter = (key: keyof EventFilter) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const isLoading = isLoadingMessages || isLoadingTodos || isLoadingPlans

  // Empty state - no session selected
  if (!sessionUuid) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]">
        <Rocket size={64} className="mb-4 opacity-30" />
        <h2 className="text-[var(--text-xl)] font-semibold mb-2">Session Timeline</h2>
        <p className="text-[var(--text-sm)]">Select a session from the sidebar to view its timeline</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      {/* Header with filters and search */}
      <div className="flex-shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-[var(--text-xl)] font-bold text-[var(--color-text-primary)] mb-4">
            Session Timeline
          </h1>

          {/* Filter toggles */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[var(--text-sm)] text-[var(--color-text-muted)] mr-2">Show:</span>
            <Button
              variant={filters.conversations ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => toggleFilter('conversations')}
            >
              <MessageSquare className="w-4 h-4" />
              Conversations
            </Button>
            <Button
              variant={filters.todos ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => toggleFilter('todos')}
            >
              <CheckCircle className="w-4 h-4" />
              Todos
            </Button>
            <Button
              variant={filters.plans ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => toggleFilter('plans')}
            >
              <FileText className="w-4 h-4" />
              Plans
            </Button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <SearchInput
              placeholder="Search events..."
              onSearch={setSearchQuery}
              debounceDelay={200}
              className="flex-1"
            />
            {searchQuery && searchMatches.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-sm)] text-[var(--color-text-muted)] whitespace-nowrap">
                  {currentMatchIndex + 1} of {searchMatches.length}
                </span>
                <Button variant="ghost" size="sm" onClick={handlePrevMatch}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleNextMatch}>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="text-center py-12 text-[var(--color-text-muted)]">
              Loading timeline events...
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-muted)]">
              {searchQuery ? 'No events match your search' : 'No events in this session'}
            </div>
          ) : (
            <Timeline events={filteredEvents} />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Get a preview of message content
 */
function getMessagePreview(msg: DBConversationMessage): string | undefined {
  if (!msg.content) return undefined

  try {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    return content.slice(0, 200)
  } catch {
    return undefined
  }
}

/**
 * ConversationEventDetails - Expanded view for conversation messages
 */
interface ConversationEventDetailsProps {
  message: DBConversationMessage
}

function ConversationEventDetails({ message }: ConversationEventDetailsProps) {
  const contentStr = useMemo(() => {
    if (!message.content) return ''
    try {
      if (typeof message.content === 'string') return message.content
      return JSON.stringify(message.content, null, 2)
    } catch {
      return String(message.content)
    }
  }, [message.content])

  return (
    <div className="space-y-3">
      {/* Metadata */}
      <div className="flex flex-wrap gap-2">
        {message.role && (
          <Badge variant="default" size="sm">
            {message.role}
          </Badge>
        )}
        {message.model && (
          <Badge variant="info" size="sm">
            {message.model}
          </Badge>
        )}
        {message.agentId && (
          <Badge variant="warning" size="sm">
            Agent: {message.agentId}
          </Badge>
        )}
      </div>

      {/* Token usage */}
      {(message.inputTokens || message.outputTokens) && (
        <div className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
          Tokens: {message.inputTokens || 0} in / {message.outputTokens || 0} out
        </div>
      )}

      {/* Content preview */}
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 max-h-96 overflow-y-auto">
        <pre className="text-[var(--text-sm)] text-[var(--color-text-secondary)] whitespace-pre-wrap font-mono">
          {contentStr.slice(0, 1000)}
          {contentStr.length > 1000 && '...'}
        </pre>
      </div>

      {/* View full link */}
      <a
        href={`/conversations/${message.conversationId}`}
        className="text-[var(--text-sm)] text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
      >
        View full conversation →
      </a>
    </div>
  )
}

/**
 * TodoEventDetails - Expanded view for todo events
 */
interface TodoEventDetailsProps {
  todo: Todo
}

function TodoEventDetails({ todo }: TodoEventDetailsProps) {
  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">Status:</span>
        <Badge
          variant={todo.status === 'completed' ? 'success' : todo.status === 'in_progress' ? 'warning' : 'default'}
          size="sm"
        >
          {todo.status}
        </Badge>
      </div>

      {/* Content */}
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3">
        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">{todo.content}</p>
      </div>

      {/* Active form */}
      {todo.active_form && (
        <div className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
          Active form: {todo.active_form}
        </div>
      )}
    </div>
  )
}

/**
 * PlanEventDetails - Expanded view for plan events
 */
interface PlanEventDetailsProps {
  plan: PlanSummary
}

function PlanEventDetails({ plan }: PlanEventDetailsProps) {
  return (
    <div className="space-y-3">
      {/* Plan metadata */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="default" size="sm">
          {plan.file_name}
        </Badge>
      </div>

      {/* Preview */}
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 max-h-48 overflow-y-auto">
        <pre className="text-[var(--text-sm)] text-[var(--color-text-secondary)] whitespace-pre-wrap">
          {plan.preview}
        </pre>
      </div>

      {/* View full link */}
      <a
        href={`/plans-search?id=${plan.id}`}
        className="text-[var(--text-sm)] text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
      >
        View full plan →
      </a>
    </div>
  )
}
