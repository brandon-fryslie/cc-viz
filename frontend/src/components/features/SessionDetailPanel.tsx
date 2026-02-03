import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageSquare, Database, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs, type Tab } from '@/components/ui/Tabs'
import { CopyableId } from '@/components/ui/CopyableId'
import {
  useConversationDetail,
  useConversationMessages,
  useRequestsSummary,
  useTodoDetail,
} from '@/lib/api'
import type { DBConversationMessage, RequestSummary, TodoItem } from '@/lib/types'

interface SessionDetailPanelProps {
  sessionUuid?: string
  activeTab: string
  onTabChange: (tab: string) => void
}

/**
 * SessionDetailPanel - Right panel showing session details with tabs
 *
 * Features:
 * - Header with session UUID (copyable), project, date range
 * - Compact stats row
 * - Tab navigation (Conversations, Requests, Todos, Plans)
 * - Virtualized content for each tab
 */
export function SessionDetailPanel({
  sessionUuid,
  activeTab,
  onTabChange,
}: SessionDetailPanelProps) {
  // Fetch session data
  const { data: conversation } = useConversationDetail(sessionUuid || null)
  const { data: messagesData } = useConversationMessages(sessionUuid || null, { limit: 1000 })
  const { data: todosData } = useTodoDetail(sessionUuid || null)
  const { data: requestsData } = useRequestsSummary()

  // Filter requests for this session (by matching conversation ID in request metadata)
  const sessionRequests = useMemo(() => {
    if (!requestsData || !sessionUuid) return []
    // This is a simplified version - you may need to adjust based on your data model
    return requestsData.filter((req) => req.requestId.includes(sessionUuid))
  }, [requestsData, sessionUuid])

  // Empty state
  if (!sessionUuid) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-3" />
          <h3 className="text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)] mb-1">
            No Session Selected
          </h3>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            Select a session from the list to view details
          </p>
        </div>
      </div>
    )
  }

  // Prepare tabs
  const tabs: Tab[] = [
    {
      value: 'conversations',
      label: 'Conversations',
      count: messagesData?.total || 0,
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      value: 'requests',
      label: 'Requests',
      count: sessionRequests.length,
      icon: <Database className="w-4 h-4" />,
    },
    {
      value: 'todos',
      label: 'Todos',
      count: todosData?.todos.length || 0,
      icon: <CheckSquare className="w-4 h-4" />,
    },
  ]

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">Session:</span>
            <CopyableId value={sessionUuid} startChars={8} endChars={4} />
          </div>
        </div>

        {conversation && (
          <div className="flex items-center gap-4 text-[var(--text-sm)] text-[var(--color-text-secondary)]">
            <span>
              <strong>Project:</strong> {conversation.projectName || 'Unknown'}
            </span>
            <span>
              <strong>Started:</strong>{' '}
              {new Date(conversation.startTime).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
        <div className="flex items-center gap-4">
          <StatItem
            label="Messages"
            value={messagesData?.total || 0}
            onClick={() => onTabChange('conversations')}
          />
          <StatItem
            label="Requests"
            value={sessionRequests.length}
            onClick={() => onTabChange('requests')}
          />
          <StatItem
            label="Todos"
            value={todosData?.todos.length || 0}
            onClick={() => onTabChange('todos')}
          />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 px-4 border-b border-[var(--color-border)]">
        <Tabs tabs={tabs} value={activeTab} onChange={onTabChange} />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'conversations' && (
          <ConversationsTabContent messages={messagesData?.messages || []} />
        )}
        {activeTab === 'requests' && <RequestsTabContent requests={sessionRequests} />}
        {activeTab === 'todos' && <TodosTabContent todos={todosData?.todos || []} />}
      </div>
    </div>
  )
}

// Stat Item Component
interface StatItemProps {
  label: string
  value: number
  onClick?: () => void
}

function StatItem({ label, value, onClick }: StatItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] transition-colors',
        onClick && 'hover:bg-[var(--color-bg-hover)] cursor-pointer'
      )}
    >
      <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">{label}</span>
      <span className="text-[var(--text-md)] font-semibold text-[var(--color-text-primary)]">
        {value.toLocaleString()}
      </span>
    </button>
  )
}

// Conversations Tab Content
interface ConversationsTabContentProps {
  messages: DBConversationMessage[]
}

function ConversationsTabContent({ messages }: ConversationsTabContentProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  })

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--color-text-muted)] text-[var(--text-sm)]">
          No messages in this session
        </div>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const message = messages[virtualRow.index]

          return (
            <div
              key={message.uuid}
              className="absolute top-0 left-0 w-full px-4 py-3 border-b border-[var(--color-border)]"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="flex items-start gap-3">
                <Badge
                  variant={message.role === 'user' ? 'info' : 'default'}
                  size="sm"
                  className="mt-1"
                >
                  {message.role || message.type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mb-1">
                    {new Date(message.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                  <div className="text-[var(--text-sm)] text-[var(--color-text-primary)] line-clamp-2">
                    {typeof message.content === 'string'
                      ? message.content
                      : JSON.stringify(message.content).slice(0, 200)}
                  </div>
                  {message.model && (
                    <div className="mt-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                      Model: {message.model}
                      {message.inputTokens && ` • ${message.inputTokens} in / ${message.outputTokens} out`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Requests Tab Content
interface RequestsTabContentProps {
  requests: RequestSummary[]
}

function RequestsTabContent({ requests }: RequestsTabContentProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: requests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  })

  if (requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--color-text-muted)] text-[var(--text-sm)]">
          No requests in this session
        </div>
      </div>
    )
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const request = requests[virtualRow.index]

          return (
            <div
              key={request.requestId}
              className="absolute top-0 left-0 w-full px-4 py-3 border-b border-[var(--color-border)]"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default" size="sm">
                      {request.method}
                    </Badge>
                    {request.model && (
                      <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                        {request.model}
                      </span>
                    )}
                  </div>
                  <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] font-mono truncate">
                    {request.requestId}
                  </div>
                  {request.usage && (
                    <div className="mt-1 text-[var(--text-xs)] text-[var(--color-text-muted)]">
                      {request.usage.input_tokens} in / {request.usage.output_tokens} out
                    </div>
                  )}
                </div>
                {request.statusCode && (
                  <Badge
                    variant={request.statusCode < 400 ? 'success' : 'error'}
                    size="sm"
                  >
                    {request.statusCode}
                  </Badge>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Todos Tab Content
interface TodosTabContentProps {
  todos: TodoItem[]
}

function TodosTabContent({ todos }: TodosTabContentProps) {
  const [localTodos, setLocalTodos] = useState(todos)

  // Update local state when props change
  useMemo(() => {
    setLocalTodos(todos)
  }, [todos])

  const handleToggle = (index: number) => {
    setLocalTodos((prev) =>
      prev.map((todo, i) =>
        i === index
          ? {
              ...todo,
              status:
                todo.status === 'completed'
                  ? 'pending'
                  : todo.status === 'pending'
                    ? 'in_progress'
                    : 'completed',
            }
          : todo
      )
    )
  }

  if (localTodos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[var(--color-text-muted)] text-[var(--text-sm)]">
          No todos in this session
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="space-y-2">
        {localTodos.map((todo, index) => (
          <Card
            key={index}
            variant="hover"
            padding="sm"
            className="flex items-start gap-3"
          >
            <input
              type="checkbox"
              checked={todo.status === 'completed'}
              onChange={() => handleToggle(index)}
              className="mt-1 w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <div className="flex-1">
              <div
                className={cn(
                  'text-[var(--text-sm)] text-[var(--color-text-primary)]',
                  todo.status === 'completed' && 'line-through text-[var(--color-text-muted)]'
                )}
              >
                {todo.content}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  size="sm"
                  variant={
                    todo.status === 'completed'
                      ? 'success'
                      : todo.status === 'in_progress'
                        ? 'info'
                        : 'default'
                  }
                >
                  {todo.status.replace('_', ' ')}
                </Badge>
                {todo.active_form && (
                  <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                    {todo.active_form}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
