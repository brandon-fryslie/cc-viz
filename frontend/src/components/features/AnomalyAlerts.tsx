import { type FC, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { AlertTriangle, TrendingUp, Activity } from 'lucide-react'
import { formatTokens } from '@/components/charts/WeeklyUsageChart'
import { Button } from '@/components/ui/Button'

interface DailyTokens {
  date: string
  tokens: number
  requests: number
  models?: Record<string, { tokens: number; requests: number }>
}

interface AnomalyAlertsProps {
  data: DailyTokens[]
  className?: string
}

interface Anomaly {
  date: string
  type: 'spike' | 'high-session' | 'model-switch'
  severity: 'high' | 'medium' | 'low'
  title: string
  description: string
  value: number
}

/**
 * AnomalyAlerts - Displays detected anomalies in token usage.
 * Features:
 * - Spike detection (>2x average)
 * - High session detection (>50K tokens)
 * - Sorted by severity
 * - Expandable to show more
 */
export const AnomalyAlerts: FC<AnomalyAlertsProps> = ({ data, className }) => {
  const [showAll, setShowAll] = useState(false)

  // Detect anomalies
  const anomalies = useMemo(() => {
    const detected: Anomaly[] = []

    // Calculate average and threshold
    const tokens = data.map((d) => d.tokens)
    const mean = tokens.reduce((sum, t) => sum + t, 0) / tokens.length
    const variance = tokens.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / tokens.length
    const stddev = Math.sqrt(variance)
    const spikeThreshold = mean + 2 * stddev

    // Detect spikes
    data.forEach((day) => {
      if (day.tokens > spikeThreshold) {
        const multiplier = (day.tokens / mean).toFixed(1)
        detected.push({
          date: day.date,
          type: 'spike',
          severity: day.tokens > mean * 3 ? 'high' : 'medium',
          title: 'Usage Spike Detected',
          description: `${multiplier}x above average (${formatTokens(Math.round(mean))})`,
          value: day.tokens,
        })
      }
    })

    // Detect high single-day usage (>50K tokens)
    data.forEach((day) => {
      if (day.tokens > 50000 && !detected.some((a) => a.date === day.date && a.type === 'spike')) {
        detected.push({
          date: day.date,
          type: 'high-session',
          severity: day.tokens > 100000 ? 'high' : 'medium',
          title: 'High Daily Usage',
          description: `Exceeded ${formatTokens(50000)} tokens in a single day`,
          value: day.tokens,
        })
      }
    })

    // Sort by severity and date (most recent first)
    return detected.sort((a, b) => {
      if (a.severity !== b.severity) {
        const severityOrder = { high: 0, medium: 1, low: 2 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [data])

  const visibleAnomalies = showAll ? anomalies : anomalies.slice(0, 5)

  if (anomalies.length === 0) {
    return (
      <Card className={className} padding="lg">
        <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-muted)]">
          <Activity className="w-12 h-12 mb-3 opacity-50" />
          <p className="font-medium">No Anomalies Detected</p>
          <p className="text-[var(--text-sm)] mt-1">Your token usage looks normal</p>
        </div>
      </Card>
    )
  }

  return (
    <Card className={className} padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)]">
          Anomaly Alerts
        </h3>
        <Badge variant="warning">{anomalies.length}</Badge>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {visibleAnomalies.map((anomaly) => {
          const date = new Date(anomaly.date + 'T00:00:00')
          const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })

          return (
            <div
              key={`${anomaly.date}-${anomaly.type}`}
              className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-[var(--radius-md)] ${
                    anomaly.severity === 'high'
                      ? 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
                      : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                  }`}
                >
                  {anomaly.type === 'spike' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)]">
                      {anomaly.title}
                    </span>
                    <Badge
                      variant={anomaly.severity === 'high' ? 'error' : 'warning'}
                      size="sm"
                    >
                      {anomaly.severity}
                    </Badge>
                  </div>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-1">
                    {dateStr}
                  </p>
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                    {anomaly.description}
                  </p>
                  <p className="text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)] mt-1">
                    {formatTokens(anomaly.value)} tokens
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {anomalies.length > 5 && (
        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show Less' : `Show ${anomalies.length - 5} More`}
          </Button>
        </div>
      )}
    </Card>
  )
}
