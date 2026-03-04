// @ts-nocheck
import { useMemo } from 'react'
import { PageHeader, PageContent } from '@/components/layout'
import { Coins, TrendingUp, Calendar, Zap, AlertTriangle } from 'lucide-react'
import { useWeeklyStats, useHourlyStats, useConversations, useProjectTokenStats } from '@/lib/api'
import { useDateRange } from '@/lib/DateRangeContext'
import { StatCard } from '@/components/charts/StatCard'
import { ChartWrapper } from '@/components/charts/ChartWrapper'
import { DailyBurnChart } from '@/components/charts/DailyBurnChart'
import { ModelBreakdownChart } from '@/components/charts/ModelBreakdownChart'
import { ProjectBreakdownChart } from '@/components/charts/ProjectBreakdownChart'
import { AnomalyAlerts } from '@/components/features/AnomalyAlerts'
import { DataList, type Column } from '@/components/ui/DataList'
import { formatTokens } from '@/components/charts/WeeklyUsageChart'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'

interface SessionRow extends Record<string, unknown> {
  sessionUuid: string
  project: string
  model: string
  tokens: number
  date: string
}

interface Metrics {
  total: number
  avgPerDay: number
  peakDay: number
  peakDate: string
}

/**
 * Validates token metrics for data quality issues
 */
function validateMetrics(metrics: Metrics): string[] {
  const errors: string[] = []
  if (metrics.total < 0) {
    errors.push('Total tokens cannot be negative')
  }
  if (metrics.avgPerDay < 0) {
    errors.push('Average tokens per day cannot be negative')
  }
  if (metrics.total > 1_000_000_000) {
    errors.push('Total tokens suspiciously high (>1B) - please verify data')
  }
  return errors
}

/**
 * Check if conversation has valid token data
 */
function hasValidTokenData(conv: { totalTokens?: number }): boolean {
  return conv.totalTokens !== undefined && conv.totalTokens > 0
}

/**
 * Error alert component for API failures
 */
function ErrorAlert({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 dark:bg-red-950/30 dark:border-red-800/50 dark:text-red-400">
      <AlertTriangle size={20} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-sm mt-1 truncate" title={message}>{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/50 dark:hover:bg-red-900/70 text-red-800 dark:text-red-300 rounded text-sm font-medium transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}

/**
 * Data quality warning banner
 */
function DataQualityWarning({ warnings }: { warnings: string[] }) {
  return (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-950/30 dark:border-yellow-800/50">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-200">Data Quality Notice</h3>
          <ul className="text-sm text-yellow-800 dark:text-yellow-300 mt-2 space-y-1">
            {warnings.map((warning, i) => (
              <li key={i}>- {warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * TokenEconomics - Financial-style dashboard for token burn tracking.
 * Features:
 * - Daily token burn trend chart with anomaly detection
 * - Cost breakdown by model and project
 * - Anomaly alerts
 * - Top token consumers table
 * - Forecasting (optional)
 */
function TokenEconomicsContent() {
  const { dateRange } = useDateRange()

  // Fetch data
  const { data: weeklyStats, isLoading: isLoadingWeekly, error: weeklyError, refetch: refetchWeekly } = useWeeklyStats(dateRange)
  const { data: hourlyStats, isLoading: isLoadingHourly } = useHourlyStats(dateRange)
  const { data: conversations, isLoading: isLoadingConversations, error: convError, refetch: refetchConversations } = useConversations()
  const { data: projectStatsData, isLoading: isLoadingProjectStats } = useProjectTokenStats(dateRange)

  // Combine all loading states
  const isLoading = isLoadingWeekly || isLoadingHourly || isLoadingConversations || isLoadingProjectStats

  // Handle critical errors
  const criticalError = weeklyError || convError
  if (criticalError && !weeklyStats) {
    const error = weeklyError || convError!
    return (
      <div className="p-6">
        <ErrorAlert
          title="Failed to load token data"
          message={error.message}
          onRetry={() => {
            if (weeklyError) refetchWeekly()
            if (convError) refetchConversations()
          }}
        />
      </div>
    )
  }

  // Process daily stats for charts
  const dailyStats = useMemo(() => {
    if (!weeklyStats?.dailyStats) return []
    return weeklyStats.dailyStats
  }, [weeklyStats])

  // Calculate key metrics
  const metrics = useMemo(() => {
    if (!dailyStats.length) return { total: 0, avgPerDay: 0, peakDay: 0, peakDate: '' }

    const total = dailyStats.reduce((sum, day) => sum + day.tokens, 0)
    const avgPerDay = total / dailyStats.length
    const peak = dailyStats.reduce(
      (max, day) => (day.tokens > max.tokens ? day : max),
      dailyStats[0]
    )

    return {
      total,
      avgPerDay,
      peakDay: peak.tokens,
      peakDate: peak.date,
    }
  }, [dailyStats])

  // Validate metrics
  const validationWarnings = useMemo(() => validateMetrics(metrics), [metrics])

  // Calculate model stats (aggregate from daily stats)
  const modelStats = useMemo(() => {
    if (!dailyStats.length) return []

    const modelMap = new Map<string, { tokens: number; requests: number }>()

    dailyStats.forEach((day) => {
      if (day.models) {
        Object.entries(day.models).forEach(([model, stats]) => {
          const existing = modelMap.get(model) || { tokens: 0, requests: 0 }
          modelMap.set(model, {
            tokens: existing.tokens + stats.tokens,
            requests: existing.requests + stats.requests,
          })
        })
      }
    })

    return Array.from(modelMap.entries()).map(([model, stats]) => ({
      model,
      tokens: stats.tokens,
      requests: stats.requests,
    }))
  }, [dailyStats])

  // Use project token stats from API (real data, not calculated from conversations)
  const projectStats = useMemo(() => {
    if (!projectStatsData?.projects) return []
    return projectStatsData.projects.map((project) => ({
      project: project.name,
      tokens: project.totalTokens,
      requests: project.conversationCount,
    }))
  }, [projectStatsData])

  // Check if we need fallback to conversation-based calculation
  const useFallbackProjectStats = !projectStatsData?.projects || projectStatsData.projects.length === 0

  const fallbackProjectStats = useMemo(() => {
    if (!useFallbackProjectStats || !conversations) return []
    if (!conversations) return []

    const projectMap = new Map<string, { tokens: number; requests: number }>()

    conversations.forEach((conv) => {
      const project = conv.projectName || 'Unknown'
      // Use actual totalTokens from API, fallback to 0 if not available
      const tokens = conv.totalTokens ?? 0
      const existing = projectMap.get(project) || { tokens: 0, requests: 0 }
      projectMap.set(project, {
        tokens: existing.tokens + tokens,
        requests: existing.requests + 1,
      })
    })

    return Array.from(projectMap.entries())
      .map(([project, stats]) => ({
        project,
        tokens: stats.tokens,
        requests: stats.requests,
      }))
      .sort((a, b) => b.tokens - a.tokens)
  }, [conversations, useFallbackProjectStats])

  // Final project stats to display
  const displayProjectStats = useMemo(() => {
    return useFallbackProjectStats ? fallbackProjectStats : projectStats
  }, [useFallbackProjectStats, fallbackProjectStats, projectStats])

  // Prepare session data for table - use project stats top conversations
  const sessionData = useMemo((): SessionRow[] => {
    if (!projectStatsData?.projects) return []

    // Collect all top conversations from all projects
    const allTopConversations: Array<{
      id: string
      project: string
      tokens: number
      messages: number
      date?: string
    }> = []

    projectStatsData.projects.forEach((project) => {
      if (project.topConversations) {
        project.topConversations.forEach((conv) => {
          allTopConversations.push({
            id: conv.conversationId,
            project: project.name,
            tokens: conv.totalTokens,
            messages: conv.messageCount,
          })
        })
      }
    })

    // Sort by tokens and take top 100
    return allTopConversations
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 100)
      .map((conv) => ({
        sessionUuid: conv.id,
        project: conv.project.length > 25 ? conv.project.substring(0, 25) + '...' : conv.project,
        model: `${conv.messages.toLocaleString()} messages`,
        tokens: conv.tokens,
        date: conv.date || 'Recent',
      }))
  }, [projectStatsData])

  // Table columns
  const columns: Column<SessionRow>[] = [
    {
      key: 'sessionUuid',
      label: 'Session',
      width: '300px',
      render: (value) => (
        <span className="font-mono text-[var(--text-xs)] text-[var(--color-text-muted)]">
          {String(value).slice(0, 8)}...
        </span>
      ),
    },
    {
      key: 'project',
      label: 'Project',
      width: '200px',
      sortable: true,
    },
    {
      key: 'model',
      label: 'Messages',
      width: '120px',
      sortable: true,
    },
    {
      key: 'tokens',
      label: 'Tokens',
      width: '120px',
      sortable: true,
      render: (value) => (
        <span className="font-semibold text-[var(--color-text-primary)]">
          {formatTokens(Number(value))}
        </span>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      width: '150px',
      sortable: true,
    },
  ]

  // Calculate trend (comparing last 7 days to previous 7 days)
  const trend = useMemo(() => {
    if (dailyStats.length < 14) return 0

    const recent7 = dailyStats.slice(-7).reduce((sum, day) => sum + day.tokens, 0)
    const previous7 = dailyStats.slice(-14, -7).reduce((sum, day) => sum + day.tokens, 0)

    if (previous7 === 0) return 0
    return ((recent7 - previous7) / previous7) * 100
  }, [dailyStats])

  return (
    <>
      <PageHeader
        title="Token Economics"
        description="Financial-style dashboard for tracking token burn and cost trends"
      />
      <PageContent>
        {/* Data quality warnings */}
        {validationWarnings.length > 0 && (
          <DataQualityWarning warnings={validationWarnings} />
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Tokens"
            value={isLoading ? '--' : formatTokens(metrics.total)}
            subtitle="Current period"
            icon={<Coins className="w-5 h-5" />}
          />
          <StatCard
            title="Avg per Day"
            value={isLoading ? '--' : formatTokens(Math.round(metrics.avgPerDay))}
            trend={{
              value: trend,
              label: 'vs previous period',
            }}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            title="Peak Day"
            value={isLoading ? '--' : formatTokens(metrics.peakDay)}
            subtitle={
              metrics.peakDate
                ? new Date(metrics.peakDate + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                : ''
            }
            icon={<Zap className="w-5 h-5" />}
          />
          <StatCard
            title="Burn Rate"
            value={isLoading ? '--' : `${formatTokens(Math.round(metrics.avgPerDay))}/day`}
            subtitle="Current average"
            icon={<Calendar className="w-5 h-5" />}
          />
        </div>

        {/* Daily Burn Chart */}
        <div className="mb-6">
          <ChartWrapper
            title="Daily Token Burn"
            description="Token usage over time with anomaly detection"
            isLoading={isLoading}
          >
            <DailyBurnChart data={dailyStats} hourlyData={hourlyStats?.hourlyStats} height={400} />
          </ChartWrapper>
        </div>

        {/* Breakdown Charts + Anomaly Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Model Breakdown */}
          <div className="lg:col-span-1">
            <ChartWrapper title="Tokens by Model" isLoading={isLoading}>
              <ModelBreakdownChart data={modelStats} metric="tokens" height={300} />
            </ChartWrapper>
          </div>

          {/* Project Breakdown */}
          <div className="lg:col-span-1">
            <ChartWrapper title="Tokens by Project" isLoading={isLoading}>
              <ProjectBreakdownChart data={displayProjectStats} height={300} />
            </ChartWrapper>
          </div>

          {/* Anomaly Alerts */}
          <div className="lg:col-span-1">
            <AnomalyAlerts data={dailyStats} />
          </div>
        </div>

        {/* Cost Data Table */}
        <div className="mb-6">
          <ChartWrapper
            title="Top Token Consumers"
            description="Sessions with highest token usage"
            isLoading={isLoading}
          >
            {sessionData.length > 0 ? (
              <DataList
                data={sessionData}
                columns={columns}
                keyField="sessionUuid"
                searchable
                rowHeight={48}
                height={400}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
                No session data available
              </div>
            )}
          </ChartWrapper>
        </div>
      </PageContent>
    </>
  )
}

/**
 * TokenEconomics page with ErrorBoundary wrapper
 */
export function TokenEconomicsPage() {
  return (
    <ErrorBoundary
      fallback={(error, retry) => (
        <div className="p-6">
          <PageHeader
            title="Token Economics"
            description="Financial-style dashboard for tracking token burn and cost trends"
          />
          <div className="mt-6">
            <ErrorAlert
              title="Page error"
              message={error.message}
              onRetry={retry}
            />
          </div>
        </div>
      )}
    >
      <TokenEconomicsContent />
    </ErrorBoundary>
  )
}
