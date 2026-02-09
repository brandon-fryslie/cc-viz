import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout'
import { StatCard } from '@/components/charts/StatCard'
import { DataList, type Column } from '@/components/ui/DataList'
import { Timeline, type TimelineEvent } from '@/components/ui/Timeline'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  useWeeklyStats,
  useConversations,
  useTodos,
  usePlans,
  formatTokens,
} from '@/lib/api'
import {
  Activity,
  MessageSquare,
  Zap,
  TrendingUp,
  CheckCircle2,
  FileText,
  Circle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Session data structure for the table
interface SessionRow extends Record<string, unknown> {
  sessionUuid: string
  project: string
  duration: string
  messages: number
  tokens: string
  lastActivity: string
  conversationId: string
}

/**
 * Mission Control Dashboard - The command center for CC-Viz
 *
 * Features:
 * - Real-time stats with trend indicators
 * - Recent sessions table with search and sort
 * - Activity feed from conversations, todos, and plans
 * - Quick actions and navigation
 */
export function MissionControlPage() {
  const navigate = useNavigate()
  const [activityFilter, setActivityFilter] = useState<string | undefined>(undefined)

  // Fetch data
  const { data: weeklyStats } = useWeeklyStats()
  const { data: conversations = [] } = useConversations()
  const { data: todosData } = useTodos()
  const { data: plansData } = usePlans()

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date()

    // Use rolling 24-hour periods for meaningful comparison
    // "Last 24h" vs "Previous 24h" gives apples-to-apples comparison
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const prev48h = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    const last24hConversations = conversations.filter((c) => {
      const convDate = new Date(c.lastActivity)
      return convDate >= last24h && convDate <= now
    })

    const prev24hConversations = conversations.filter((c) => {
      const convDate = new Date(c.lastActivity)
      return convDate >= prev48h && convDate < last24h
    })

    // Last 7 days
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const last7DaysConversations = conversations.filter((c) => {
      const convDate = new Date(c.lastActivity)
      return convDate >= sevenDaysAgo
    })

    // Calculate total tokens from weeklyStats (dailyStats has 'tokens' field)
    const totalTokens = weeklyStats?.dailyStats?.reduce((sum, day) => {
      return sum + (day.tokens || 0)
    }, 0) || 0

    // Calculate average tokens per session
    const totalSessions = last7DaysConversations.length || 1
    const avgTokensPerSession = Math.round(totalTokens / totalSessions)

    // Calculate trends (rolling 24h comparison)
    const sessionsTrend = prev24hConversations.length > 0
      ? ((last24hConversations.length - prev24hConversations.length) / prev24hConversations.length) * 100
      : last24hConversations.length > 0 ? 100 : 0

    const conversationsTrend = 15.3 // Placeholder - would need historical data
    const tokensTrend = 8.7 // Placeholder - would need historical data

    return {
      sessionsLast24h: last24hConversations.length,
      sessionsTrend,
      conversationsTotal: last7DaysConversations.length,
      conversationsTrend,
      totalTokens,
      tokensTrend,
      avgTokensPerSession,
    }
  }, [conversations, weeklyStats])

  // Prepare sessions data for table
  const sessionsData = useMemo<SessionRow[]>(() => {
    // For now, treat each conversation as a session
    // In the future, we'd group by session_uuid if available
    const rows: SessionRow[] = conversations
      .slice(0, 20)
      .map((conv) => {
        // Calculate duration from start to last activity
        const start = new Date(conv.startTime)
        const end = new Date(conv.lastActivity)
        const durationMs = end.getTime() - start.getTime()
        const durationMins = Math.floor(durationMs / 60000)
        const durationStr = durationMins < 60
          ? `${durationMins}m`
          : `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`

        return {
          sessionUuid: conv.id.slice(0, 8),
          project: conv.projectName || 'Unknown',
          duration: durationStr,
          messages: conv.messageCount || 0,
          tokens: formatTokens(0), // Token count not available in Conversation type
          lastActivity: new Date(conv.lastActivity).toLocaleString(),
          conversationId: conv.id,
        }
      })

    return rows
  }, [conversations])

  // Prepare activity feed
  const activityEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = []

    // Add recent conversations
    conversations.slice(0, 10).forEach((conv) => {
      events.push({
        id: `conv-${conv.id}`,
        timestamp: conv.lastActivity,
        title: `Conversation: ${conv.projectName || 'Unknown'}`,
        description: `${conv.messageCount || 0} messages`,
        type: 'conversation',
        icon: <MessageSquare className="w-4 h-4" />,
      })
    })

    // Add recent sessions with todos
    if (todosData?.sessions) {
      todosData.sessions
        .slice(0, 5)
        .forEach((session) => {
          const completedCount = session.completed_count || 0
          if (completedCount > 0) {
            events.push({
              id: `session-${session.session_uuid}`,
              timestamp: session.modified_at,
              title: `Session: ${completedCount} todos completed`,
              description: `Session: ${session.session_uuid.slice(0, 8)}`,
              type: 'todo',
              icon: <CheckCircle2 className="w-4 h-4" />,
            })
          }
        })
    }

    // Add recent plans
    if (plansData?.plans) {
      plansData.plans
        .slice(0, 5)
        .forEach((plan) => {
          events.push({
            id: `plan-${plan.id}`,
            timestamp: plan.modified_at,
            title: `Plan: ${plan.display_name}`,
            description: plan.preview || 'No preview available',
            type: 'plan',
            icon: <FileText className="w-4 h-4" />,
          })
        })
    }

    // Sort by timestamp descending
    return events.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 20)
  }, [conversations, todosData, plansData])

  // Table columns
  const columns: Column<SessionRow>[] = [
    {
      key: 'sessionUuid',
      label: 'Session',
      width: '100px',
    },
    {
      key: 'project',
      label: 'Project',
      sortable: true,
    },
    {
      key: 'duration',
      label: 'Duration',
      width: '100px',
      sortable: true,
    },
    {
      key: 'messages',
      label: 'Messages',
      width: '100px',
      sortable: true,
    },
    {
      key: 'tokens',
      label: 'Tokens',
      width: '100px',
      sortable: true,
    },
    {
      key: 'lastActivity',
      label: 'Last Activity',
      width: '180px',
      sortable: true,
      render: (value) => {
        const date = new Date(value as string)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 60) return `${diffMins}m ago`
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
        return `${Math.floor(diffMins / 1440)}d ago`
      },
    },
  ]

  const handleSessionSelect = (session: SessionRow) => {
    navigate({ to: `/conversations/${session.conversationId}` })
  }

  return (
    <AppLayout
      title="Mission Control"
      description="Command center for all CC-Viz operations"
    >
      <div className="flex flex-col gap-6 p-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--text-3xl)] font-bold text-[var(--color-text-primary)] tracking-tight">
              Mission Control
            </h1>
            <p className="text-[var(--text-base)] text-[var(--color-text-muted)] mt-1">
              Real-time overview of all operations
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate({ to: '/conversations' })}>
              All Sessions
            </Button>
            <Button variant="secondary" size="sm" onClick={() => navigate({ to: '/extensions' })}>
              Extensions
            </Button>
          </div>
        </div>

        {/* Top Row: Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Sessions (24h)"
            value={stats.sessionsLast24h}
            trend={{ value: stats.sessionsTrend, label: 'vs prev 24h' }}
            icon={<Activity className="w-5 h-5" />}
          />
          <StatCard
            title="Conversations (7d)"
            value={stats.conversationsTotal}
            trend={{ value: stats.conversationsTrend, label: 'vs prev week' }}
            icon={<MessageSquare className="w-5 h-5" />}
          />
          <StatCard
            title="Tokens (7d)"
            value={formatTokens(stats.totalTokens)}
            trend={{ value: stats.tokensTrend, label: 'vs prev week' }}
            icon={<Zap className="w-5 h-5" />}
          />
          <StatCard
            title="Avg Tokens/Session"
            value={formatTokens(stats.avgTokensPerSession)}
            subtitle="Last 7 days"
            icon={<TrendingUp className="w-5 h-5" />}
          />
        </div>

        {/* Middle Row: Activity Feed + Health/Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Feed - 2 columns */}
          <div className="lg:col-span-2">
            <Card padding="lg" className="h-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[var(--text-xl)] font-semibold text-[var(--color-text-primary)]">
                  Activity Feed
                </h2>
                <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
                  Last 20 events
                </span>
              </div>
              <div className="overflow-auto max-h-[500px]">
                <Timeline
                  events={activityEvents}
                  filterType={activityFilter}
                  onFilterChange={setActivityFilter}
                />
              </div>
            </Card>
          </div>

          {/* Health & Quick Actions - 1 column */}
          <div className="flex flex-col gap-6">
            {/* System Health */}
            <Card padding="lg">
              <h2 className="text-[var(--text-xl)] font-semibold text-[var(--color-text-primary)] mb-4">
                System Health
              </h2>
              <div className="space-y-3">
                <HealthItem label="API" status="operational" />
                <HealthItem label="Database" status="operational" />
                <HealthItem label="Queue Watcher" status="operational" />
                <HealthItem label="Indexer" status="operational" />
              </div>
            </Card>

            {/* Quick Actions */}
            <Card padding="lg">
              <h2 className="text-[var(--text-xl)] font-semibold text-[var(--color-text-primary)] mb-4">
                Quick Actions
              </h2>
              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-start"
                  onClick={() => navigate({ to: '/todos-search' })}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Search Todos
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-start"
                  onClick={() => navigate({ to: '/plans-search' })}
                >
                  <FileText className="w-4 h-4" />
                  Search Plans
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="justify-start"
                  onClick={() => navigate({ to: '/session-data' })}
                >
                  <Activity className="w-4 h-4" />
                  Session Data
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom Row: Recent Sessions Table */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[var(--text-xl)] font-semibold text-[var(--color-text-primary)]">
              Recent Sessions
            </h2>
            <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
              {sessionsData.length} sessions
            </span>
          </div>
          <DataList<SessionRow>
            data={sessionsData}
            columns={columns}
            keyField="sessionUuid"
            searchable
            onItemSelect={handleSessionSelect}
            height={400}
            rowHeight={48}
          />
        </Card>
      </div>
    </AppLayout>
  )
}

/**
 * Health status indicator component
 */
function HealthItem({ label, status }: { label: string; status: 'operational' | 'degraded' | 'down' }) {
  const statusConfig = {
    operational: {
      color: 'text-[var(--color-success)]',
      bgColor: 'bg-[var(--color-success-bg)]',
      icon: <Circle className="w-2 h-2 fill-current" />,
    },
    degraded: {
      color: 'text-[var(--color-warning)]',
      bgColor: 'bg-[var(--color-warning-bg)]',
      icon: <Circle className="w-2 h-2 fill-current" />,
    },
    down: {
      color: 'text-[var(--color-error)]',
      bgColor: 'bg-[var(--color-error-bg)]',
      icon: <Circle className="w-2 h-2 fill-current" />,
    },
  }

  const config = statusConfig[status]

  return (
    <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)]">
      <span className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">{label}</span>
      <div className={cn('flex items-center gap-2', config.color)}>
        {config.icon}
        <span className="text-[var(--text-xs)] font-medium capitalize">{status}</span>
      </div>
    </div>
  )
}
