import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar, MessageSquare } from 'lucide-react'
import { useConversations } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SearchInput } from '@/components/ui/SearchInput'
import { cn } from '@/lib/utils'

interface SessionListSidebarProps {
  selectedSession?: string
  onSessionSelect: (sessionUuid: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

interface SessionGroup {
  label: string
  sessions: SessionInfo[]
}

interface SessionInfo {
  sessionUuid: string
  projectName: string
  messageCount: number
  lastActivity: string
}

type SortOption = 'date-newest' | 'date-oldest' | 'activity' | 'messages'

/**
 * SessionListSidebar - Beautiful collapsible sidebar showing all sessions
 *
 * Features:
 * - Sessions grouped by date (Today, Yesterday, This Week, Older)
 * - Search functionality
 * - Sort options
 * - Keyboard navigation
 * - Smooth collapse/expand animation
 */
export function SessionListSidebar({
  selectedSession,
  onSessionSelect,
  isCollapsed,
  onToggleCollapse,
}: SessionListSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('date-newest')

  const { data: conversations, isLoading } = useConversations()

  // Group conversations by session_uuid and transform to SessionInfo
  const sessions = useMemo(() => {
    if (!conversations) return []

    const sessionMap = new Map<string, SessionInfo>()

    conversations.forEach((conv) => {
      // Extract session UUID from conversation ID (format: {project}:{sessionUuid})
      const parts = conv.id.split(':')
      const sessionUuid = parts.length > 1 ? parts.slice(1).join(':') : conv.id

      const existing = sessionMap.get(sessionUuid)
      if (!existing) {
        sessionMap.set(sessionUuid, {
          sessionUuid,
          projectName: conv.projectName,
          messageCount: conv.messageCount,
          lastActivity: conv.lastActivity,
        })
      } else {
        // Aggregate if we see the same session again
        existing.messageCount += conv.messageCount
        if (new Date(conv.lastActivity) > new Date(existing.lastActivity)) {
          existing.lastActivity = conv.lastActivity
        }
      }
    })

    return Array.from(sessionMap.values())
  }, [conversations])

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions

    const query = searchQuery.toLowerCase()
    return sessions.filter(
      (s) =>
        s.sessionUuid.toLowerCase().includes(query) ||
        s.projectName.toLowerCase().includes(query)
    )
  }, [sessions, searchQuery])

  // Sort sessions
  const sortedSessions = useMemo(() => {
    const sorted = [...filteredSessions]

    switch (sortBy) {
      case 'date-newest':
        sorted.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
        break
      case 'date-oldest':
        sorted.sort((a, b) => new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime())
        break
      case 'activity':
        sorted.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
        break
      case 'messages':
        sorted.sort((a, b) => b.messageCount - a.messageCount)
        break
    }

    return sorted
  }, [filteredSessions, sortBy])

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const groups: SessionGroup[] = [
      { label: 'Today', sessions: [] },
      { label: 'Yesterday', sessions: [] },
      { label: 'This Week', sessions: [] },
      { label: 'Older', sessions: [] },
    ]

    sortedSessions.forEach((session) => {
      const activityDate = new Date(session.lastActivity)
      const activityDay = new Date(activityDate.getFullYear(), activityDate.getMonth(), activityDate.getDate())

      if (activityDay.getTime() === today.getTime()) {
        groups[0].sessions.push(session)
      } else if (activityDay.getTime() === yesterday.getTime()) {
        groups[1].sessions.push(session)
      } else if (activityDay.getTime() >= weekAgo.getTime()) {
        groups[2].sessions.push(session)
      } else {
        groups[3].sessions.push(session)
      }
    })

    // Filter out empty groups
    return groups.filter((g) => g.sessions.length > 0)
  }, [sortedSessions])

  // Collapsed view - just toggle button
  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="mt-4 flex flex-col gap-2 items-center">
          <Calendar className="w-5 h-5 text-[var(--color-text-muted)]" />
          <Badge variant="default" size="sm">
            {sessions.length}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <div className="w-60 h-full bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[var(--color-accent)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)] text-[var(--text-base)]">
              Sessions
            </h2>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-[var(--radius-md)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-all"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <SearchInput
          placeholder="Search sessions..."
          onSearch={setSearchQuery}
          debounceDelay={200}
          className="mb-3"
        />

        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="flex-1 px-2 py-1.5 text-[var(--text-sm)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          >
            <option value="date-newest">Date (newest)</option>
            <option value="date-oldest">Date (oldest)</option>
            <option value="activity">Activity</option>
            <option value="messages">Message count</option>
          </select>
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {isLoading ? (
          <div className="text-center py-8 text-[var(--color-text-muted)] text-[var(--text-sm)]">
            Loading sessions...
          </div>
        ) : groupedSessions.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)] text-[var(--text-sm)]">
            {searchQuery ? 'No sessions found' : 'No sessions yet'}
          </div>
        ) : (
          groupedSessions.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <h3 className="text-[var(--text-xs)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2 px-1">
                {group.label}
              </h3>

              {/* Sessions in group */}
              <div className="space-y-2">
                {group.sessions.map((session) => (
                  <SessionCard
                    key={session.sessionUuid}
                    session={session}
                    isSelected={selectedSession === session.sessionUuid}
                    onClick={() => onSessionSelect(session.sessionUuid)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
        <div className="flex items-center justify-between text-[var(--text-xs)] text-[var(--color-text-muted)]">
          <span>Total sessions</span>
          <Badge variant="default" size="sm">
            {filteredSessions.length}
          </Badge>
        </div>
      </div>
    </div>
  )
}

/**
 * SessionCard - Individual session card in the list
 */
interface SessionCardProps {
  session: SessionInfo
  isSelected: boolean
  onClick: () => void
}

function SessionCard({ session, isSelected, onClick }: SessionCardProps) {
  const truncatedUuid = session.sessionUuid.slice(0, 8)

  return (
    <Card
      variant="clickable"
      padding="sm"
      className={cn(
        'transition-all duration-200',
        isSelected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-[var(--elevation-2)]'
          : 'border-[var(--color-border)]'
      )}
      onClick={onClick}
    >
      <div className="flex flex-col gap-2">
        {/* UUID and project */}
        <div>
          <div className="font-mono text-[var(--text-xs)] text-[var(--color-accent)] font-medium">
            {truncatedUuid}...
          </div>
          <div className="text-[var(--text-sm)] text-[var(--color-text-primary)] font-medium truncate mt-0.5">
            {session.projectName}
          </div>
        </div>

        {/* Message count and date */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <MessageSquare className="w-3 h-3" />
            <span className="text-[var(--text-xs)]">{session.messageCount}</span>
          </div>
          <span className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
            {formatRelativeTime(session.lastActivity)}
          </span>
        </div>
      </div>
    </Card>
  )
}

/**
 * Format timestamp as relative time (e.g., "2h ago", "3d ago")
 */
function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
