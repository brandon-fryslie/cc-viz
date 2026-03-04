// @ts-nocheck
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ResizablePanel, Panel, PanelGroup } from '@/components/layout'
import { SessionListPanel } from '@/components/features/SessionListPanel'
import { SessionDetailPanel } from '@/components/features/SessionDetailPanel'

/**
 * CockpitView - IDE-style session browser with split view
 *
 * Features:
 * - Left panel: Virtualized session list with search and selection
 * - Right panel: Session details with tabs (Conversations, Requests, Todos, Plans)
 * - Resizable panels with elegant drag handle
 * - Keyboard navigation and shortcuts
 */
export function CockpitView() {
  const navigate = useNavigate()

  // Get selected session from URL params
  const search = useSearch({ strict: false }) as { session?: string; tab?: string }
  const selectedSession = search.session
  const activeTab = search.tab || 'conversations'

  // Handle session selection
  const handleSessionSelect = (sessionUuid: string) => {
    navigate({
      to: '/cockpit',
      search: { session: sessionUuid, tab: activeTab },
    })
  }

  // Handle tab change
  const handleTabChange = (tab: string) => {
    navigate({
      to: '/cockpit',
      search: { session: selectedSession, tab },
    })
  }

  return (
    <div className="flex h-full overflow-hidden bg-[var(--color-bg-primary)]">
      <PanelGroup>
        {/* Left Panel - Session List */}
        <ResizablePanel
          defaultWidth={280}
          minWidth={200}
          maxWidth={400}
          direction="right"
          className="border-r border-[var(--color-border)]"
        >
          <SessionListPanel
            selectedSession={selectedSession}
            onSessionSelect={handleSessionSelect}
          />
        </ResizablePanel>

        {/* Right Panel - Session Detail */}
        <Panel>
          <SessionDetailPanel
            sessionUuid={selectedSession}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </Panel>
      </PanelGroup>
    </div>
  )
}
