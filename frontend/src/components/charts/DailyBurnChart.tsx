import { type FC, useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { formatTokens, getModelColor, getModelDisplayName } from './WeeklyUsageChart'
import { Button } from '@/components/ui/Button'

interface DailyTokens {
  date: string
  tokens: number
  requests: number
  models?: Record<string, { tokens: number; requests: number }>
}

interface HourlyTokens {
  hour: number
  tokens: number
  requests: number
  models?: Record<string, { tokens: number; requests: number }>
}

interface DailyBurnChartProps {
  data: DailyTokens[]
  hourlyData?: HourlyTokens[]
  height?: number
}

interface ChartDataPoint {
  date: string
  dateLabel: string
  totalTokens: number
  totalRequests: number
  isAnomaly: boolean
  [model: string]: unknown
}

interface HourlyChartDataPoint {
  hour: number
  hourLabel: string
  totalTokens: number
  totalRequests: number
  [model: string]: unknown
}

/**
 * DailyBurnChart - Area chart showing token burn over time with anomaly detection.
 * Features:
 * - Stacked area chart by model (daily view)
 * - Bar chart by hour (hourly view)
 * - Anomaly highlighting (>2x average)
 * - Toggle between daily/hourly and stacked/total views
 * - Smooth animations
 */
export const DailyBurnChart: FC<DailyBurnChartProps> = ({ data, hourlyData, height = 400 }) => {
  const [timeView, setTimeView] = useState<'daily' | 'hourly'>('daily')
  const [viewMode, setViewMode] = useState<'stacked' | 'total'>('stacked')

  // Check if the last day is today (incomplete)
  const isLastDayIncomplete = useMemo(() => {
    if (data.length === 0) return false
    const lastDate = new Date(data[data.length - 1].date + 'T00:00:00')
    const today = new Date()
    return lastDate.toDateString() === today.toDateString()
  }, [data])

  // Get all unique models
  const allModels = useMemo(() => {
    const modelSet = new Set<string>()
    data.forEach((day) => {
      if (day.models) {
        Object.keys(day.models).forEach((model) => modelSet.add(model))
      }
    })
    return Array.from(modelSet).sort()
  }, [data])

  // Get all unique models from hourly data
  const hourlyModels = useMemo(() => {
    const modelSet = new Set<string>()
    hourlyData?.forEach((hour) => {
      if (hour.models) {
        Object.keys(hour.models).forEach((model) => modelSet.add(model))
      }
    })
    return Array.from(modelSet).sort()
  }, [hourlyData])

  // Calculate average and standard deviation for anomaly detection (daily)
  const stats = useMemo(() => {
    const tokens = data.map((d) => d.tokens)
    if (tokens.length === 0) return { mean: 0, stddev: 0, anomalyThreshold: 0 }
    const mean = tokens.reduce((sum, t) => sum + t, 0) / tokens.length
    const variance = tokens.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / tokens.length
    const stddev = Math.sqrt(variance)
    const anomalyThreshold = mean + 2 * stddev

    return { mean, stddev, anomalyThreshold }
  }, [data])

  // Transform daily data for chart
  const chartData = useMemo((): ChartDataPoint[] => {
    return data.map((day) => {
      const date = new Date(day.date + 'T00:00:00')
      const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const isAnomaly = day.tokens > stats.anomalyThreshold

      const result: ChartDataPoint = {
        date: day.date,
        dateLabel,
        totalTokens: day.tokens,
        totalRequests: day.requests,
        isAnomaly,
      }

      // Add each model's tokens
      allModels.forEach((model) => {
        result[model] = day.models?.[model]?.tokens || 0
      })

      return result
    })
  }, [data, allModels, stats.anomalyThreshold])

  // Transform hourly data for chart
  const hourlyChartData = useMemo((): HourlyChartDataPoint[] => {
    if (!hourlyData) return []

    return hourlyData.map((hour) => {
      const hourLabel = `${hour.hour.toString().padStart(2, '0')}:00`

      const result: HourlyChartDataPoint = {
        hour: hour.hour,
        hourLabel,
        totalTokens: hour.tokens,
        totalRequests: hour.requests,
      }

      // Add each model's tokens
      hourlyModels.forEach((model) => {
        result[model] = hour.models?.[model]?.tokens || 0
      })

      return result
    })
  }, [hourlyData, hourlyModels])

  // Custom tooltip for daily view
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null

    const dayData = timeView === 'daily'
      ? chartData.find((d) => d.dateLabel === label)
      : hourlyChartData.find((d) => d.hourLabel === label)

    if (!dayData) return null

    const labelText = timeView === 'daily' ? label : label

    return (
      <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--elevation-2)] p-3 text-[var(--text-sm)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-[var(--color-text-primary)]">{labelText}</span>
          {timeView === 'daily' && dayData.isAnomaly && (
            <span className="text-[var(--text-xs)] px-2 py-0.5 bg-[var(--color-warning-bg)] text-[var(--color-warning)] rounded-[var(--radius-sm)]">
              Anomaly
            </span>
          )}
        </div>
        <div className="space-y-1">
          {payload
            .filter((p: any) => p.value > 0)
            .sort((a: any, b: any) => b.value - a.value)
            .map((p: any) => (
              <div key={p.dataKey} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-[var(--radius-sm)]"
                  style={{ backgroundColor: p.fill || p.stroke }}
                />
                <span className="text-[var(--color-text-muted)]">{getModelDisplayName(p.dataKey)}:</span>
                <span className="font-medium text-[var(--color-text-primary)]">{formatTokens(p.value)}</span>
              </div>
            ))}
        </div>
        <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Total:</span>
            <span className="font-semibold text-[var(--color-text-primary)]">
              {formatTokens(dayData.totalTokens)}
            </span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)] text-[var(--text-xs)]">
            <span>Requests:</span>
            <span>{dayData.totalRequests.toLocaleString()}</span>
          </div>
        </div>
      </div>
    )
  }

  // Don't render hourly if no data
  if (timeView === 'hourly' && (!hourlyData || hourlyData.length === 0)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={timeView === 'daily' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTimeView('daily')}
            >
              Daily
            </Button>
            <Button
              variant={timeView === 'hourly' ? 'primary' : 'ghost'}
              size="sm"
              disabled
            >
              Hourly
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
          No hourly data available
        </div>
      </div>
    )
  }

  const chart = timeView === 'daily' ? (
    <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
      <defs>
        {viewMode === 'stacked' ? (
          allModels.map((model) => (
            <linearGradient key={model} id={`gradient-${model}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={getModelColor(model)} stopOpacity={0.8} />
              <stop offset="95%" stopColor={getModelColor(model)} stopOpacity={0.1} />
            </linearGradient>
          ))
        ) : (
          <linearGradient id="gradient-total" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
          </linearGradient>
        )}
      </defs>

      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />

      <XAxis
        dataKey="dateLabel"
        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: 'var(--color-border)' }}
      />

      <YAxis
        tickFormatter={formatTokens}
        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        width={60}
      />

      <Tooltip content={<CustomTooltip />} />

      <Legend
        formatter={(value) => getModelDisplayName(value)}
        wrapperStyle={{ paddingTop: '10px' }}
      />

      {/* Average line */}
      <ReferenceLine
        y={stats.mean}
        stroke="var(--color-text-muted)"
        strokeDasharray="5 5"
        label={{
          value: `Avg: ${formatTokens(Math.round(stats.mean))}`,
          position: 'right',
          fill: 'var(--color-text-muted)',
          fontSize: 11,
        }}
      />

      {/* Anomaly threshold line */}
      <ReferenceLine
        y={stats.anomalyThreshold}
        stroke="var(--color-warning)"
        strokeDasharray="3 3"
        strokeOpacity={0.5}
      />

      {/* Partial day indicator */}
      {isLastDayIncomplete && chartData.length > 0 && (
        <ReferenceLine
          x={chartData[chartData.length - 1]?.dateLabel}
          stroke="var(--color-text-muted)"
          strokeDasharray="4 4"
          strokeWidth={2}
          label={{
            value: '↓ Partial today',
            position: 'top',
            fill: 'var(--color-text-muted)',
            fontSize: 11,
            offset: 5,
          }}
        />
      )}

      {viewMode === 'stacked' ? (
        allModels.map((model) => (
          <Area
            key={model}
            type="monotone"
            dataKey={model}
            stackId="tokens"
            stroke={getModelColor(model)}
            fill={`url(#gradient-${model})`}
            strokeWidth={2}
            animationDuration={500}
          />
        ))
      ) : (
        <Area
          type="monotone"
          dataKey="totalTokens"
          stroke="#3b82f6"
          fill="url(#gradient-total)"
          strokeWidth={2}
          animationDuration={500}
        />
      )}
    </AreaChart>
  ) : (
    <BarChart data={hourlyChartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />

      <XAxis
        dataKey="hourLabel"
        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        tickLine={false}
        axisLine={{ stroke: 'var(--color-border)' }}
      />

      <YAxis
        tickFormatter={formatTokens}
        tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        width={60}
      />

      <Tooltip content={<CustomTooltip />} />

      <Legend
        formatter={(value) => getModelDisplayName(value)}
        wrapperStyle={{ paddingTop: '10px' }}
      />

      {viewMode === 'stacked' ? (
        hourlyModels.map((model) => (
          <Bar
            key={model}
            dataKey={model}
            stackId="tokens"
            fill={getModelColor(model)}
            animationDuration={500}
          />
        ))
      ) : (
        <Bar
          dataKey="totalTokens"
          fill="#3b82f6"
          animationDuration={500}
        />
      )}
    </BarChart>
  )

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={timeView === 'daily' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTimeView('daily')}
          >
            Daily
          </Button>
          <Button
            variant={timeView === 'hourly' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTimeView('hourly')}
          >
            Hourly
          </Button>
          <div className="w-px h-6 bg-[var(--color-border)] mx-2" />
          <Button
            variant={viewMode === 'stacked' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('stacked')}
          >
            Stacked
          </Button>
          <Button
            variant={viewMode === 'total' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('total')}
          >
            Total
          </Button>
        </div>
        <div className="flex items-center gap-4">
          {isLastDayIncomplete && timeView === 'daily' && (
            <span className="text-[var(--text-xs)] text-[var(--color-text-muted)] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--color-warning)]"></span>
              Partial today
            </span>
          )}
          {timeView === 'daily' && (
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
              Anomaly: {formatTokens(Math.round(stats.anomalyThreshold))}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={height}>
        {chart}
      </ResponsiveContainer>
    </div>
  )
}
