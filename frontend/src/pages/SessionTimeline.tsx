import { useState } from 'react'
import { AppLayout } from '@/components/layout'
import { SessionListSidebar } from '@/components/features/SessionListSidebar'
import { SessionEventTimeline } from '@/components/features/SessionEventTimeline'

/**
 * SessionTimeline - Beautiful view showing chronological session events
 *
 * Features:
 * - Left sidebar with session list (grouped by date, searchable, sortable)
 * - Central timeline with interleaved events (conversations, todos, plans)
 * - Expandable event cards with smooth animations
 * - Filtering and search capabilities
 */
export function SessionTimeline() {
  // Session selection state (use URL params later if needed)
  const [selectedSession, setSelectedSession] = useState<string | undefined>(undefined)

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Handle session selection
  const handleSessionSelect = (sessionUuid: string) => {
    setSelectedSession(sessionUuid)
  }

  return (
    <AppLayout>
      <div className="flex h-full overflow-hidden">
        {/* Left Sidebar - Session List */}
        <SessionListSidebar
          selectedSession={selectedSession}
          onSessionSelect={handleSessionSelect}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Central Timeline */}
        <div className="flex-1 overflow-hidden">
          <SessionEventTimeline sessionUuid={selectedSession} />
        </div>
      </div>
    </AppLayout>
  )
}
