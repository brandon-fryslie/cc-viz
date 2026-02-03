import { useMemo, useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useConversations } from '@/lib/api'
import type { Conversation } from '@/lib/types'

interface SessionListPanelProps {
  selectedSession?: string
  onSessionSelect: (sessionUuid: string) => void
}

/**
 * SessionListPanel - Left panel with virtualized session list
 *
 * Features:
 * - Virtualized list for 1000+ sessions
 * - Search filtering
 * - Keyboard navigation (arrow keys, enter)
 * - Selection highlighting
 */
export function SessionListPanel({ selectedSession, onSessionSelect }: SessionListPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const parentRef = useRef<HTMLDivElement>(null)

  // Fetch all conversations
  const { data: conversations = [], isLoading, error } = useConversations()

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery) return conversations

    const lowerQuery = searchQuery.toLowerCase()
    return conversations.filter((conv) => {
      return (
        conv.id.toLowerCase().includes(lowerQuery) ||
        conv.projectName?.toLowerCase().includes(lowerQuery)
      )
    })
  }, [conversations, searchQuery])

  // Sort by last activity (newest first)
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    })
  }, [filteredSessions])

  // Virtualizer for performance
  const virtualizer = useVirtualizer({
    count: sortedSessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Height of each row
    overscan: 10,
  })

  // Handle row click
  const handleRowClick = (session: Conversation, index: number) => {
    setSelectedIndex(index)
    onSessionSelect(session.id)
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sortedSessions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        {
          const newIndex = Math.min(selectedIndex + 1, sortedSessions.length - 1)
          setSelectedIndex(newIndex)
          if (newIndex >= 0) {
            onSessionSelect(sortedSessions[newIndex].id)
          }
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        {
          const newIndex = Math.max(selectedIndex - 1, 0)
          setSelectedIndex(newIndex)
          if (newIndex >= 0) {
            onSessionSelect(sortedSessions[newIndex].id)
          }
        }
        break
      case 'Enter':
        if (selectedIndex >= 0) {
          onSessionSelect(sortedSessions[selectedIndex].id)
        }
        break
    }
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else if (diffHours < 48) {
      return 'Yesterday'
    } else if (diffHours < 168) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div
      className="flex flex-col h-full bg-[var(--color-bg-secondary)]"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-[var(--text-md)] font-semibold text-[var(--color-text-primary)] mb-3">
          Sessions
        </h2>

        {/* Search Input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
            <Search className="w-4 h-4" />
          </div>
          <Input
            type="search"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            size="sm"
          />
        </div>

        {/* Count Badge */}
        <div className="mt-2 text-[var(--text-xs)] text-[var(--color-text-muted)]">
          {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}
        </div>
      </div>

      {/* Session List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-[var(--color-text-muted)] text-[var(--text-sm)]">
            Loading sessions...
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-[var(--color-error)] text-[var(--text-sm)]">
            Failed to load sessions
          </div>
        </div>
      ) : sortedSessions.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-[var(--color-text-muted)] text-[var(--text-sm)]">
            {searchQuery ? 'No sessions found' : 'No sessions available'}
          </div>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const session = sortedSessions[virtualRow.index]
              const isSelected = session.id === selectedSession

              return (
                <div
                  key={session.id}
                  className={cn(
                    'absolute top-0 left-0 w-full px-3 py-2 border-b border-[var(--color-border)] cursor-pointer transition-all',
                    isSelected
                      ? 'bg-[var(--color-bg-active)] border-l-2 border-l-[var(--color-accent)]'
                      : 'hover:bg-[var(--color-bg-hover)]'
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => handleRowClick(session, virtualRow.index)}
                >
                  {/* Session UUID (truncated) */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'font-mono text-[var(--text-xs)] truncate',
                        isSelected
                          ? 'text-[var(--color-text-primary)] font-semibold'
                          : 'text-[var(--color-text-secondary)]'
                      )}
                      title={session.id}
                    >
                      {session.id.slice(0, 8)}...{session.id.slice(-4)}
                    </span>
                    <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] ml-2">
                      {formatDate(session.lastActivity)}
                    </span>
                  </div>

                  {/* Project Name */}
                  {session.projectName && (
                    <div className="text-[var(--text-sm)] text-[var(--color-text-secondary)] truncate mb-1">
                      {session.projectName}
                    </div>
                  )}

                  {/* Stats Row */}
                  <div className="flex items-center gap-2">
                    <Badge size="sm" variant="default">
                      {session.messageCount} msg
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
