import { type FC, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { formatTokens } from './WeeklyUsageChart'

interface ProjectStat {
  project: string
  tokens: number
  requests: number
}

interface ProjectBreakdownChartProps {
  data: ProjectStat[]
  height?: number
}

// Project colors - vibrant palette for financial dashboard
const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#10b981', // green
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ef4444', // red
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
  '#a855f7', // purple
]

/**
 * ProjectBreakdownChart - Donut chart showing token distribution by project.
 * Features:
 * - Beautiful donut chart with center text
 * - Legend with percentages
 * - Consolidates small projects into "Other" (items < 2% of total)
 * - Shows up to 8 main projects + Other
 */
export const ProjectBreakdownChart: FC<ProjectBreakdownChartProps> = ({ data, height = 300 }) => {
  // Process data: consolidate items <2% into "Other", limit to top 8 + Other
  const chartData = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.tokens, 0)
    const threshold = total * 0.02 // 2% threshold - show more projects

    // Sort by tokens descending
    const sorted = [...data].sort((a, b) => b.tokens - a.tokens)

    // Take top 8 projects (or fewer if they don't meet threshold)
    const topProjects: typeof sorted = []
    const otherProjects: typeof sorted = []

    for (const item of sorted) {
      if (topProjects.length < 8 && item.tokens >= threshold) {
        topProjects.push(item)
      } else {
        otherProjects.push(item)
      }
    }

    // If any remaining projects qualify for top 8 by 2% threshold, include them
    for (const item of otherProjects) {
      if (topProjects.length < 8 && item.tokens >= threshold) {
        topProjects.push(item)
      }
    }

    const result = topProjects.map((item, index) => ({
      name: item.project.length > 20 ? item.project.substring(0, 20) + '...' : item.project,
      fullName: item.project,
      value: item.tokens,
      requests: item.requests,
      color: PROJECT_COLORS[index % PROJECT_COLORS.length],
      percentage: ((item.tokens / total) * 100).toFixed(1),
    }))

    // Add "Other" for remaining projects
    const otherTotal = otherProjects.reduce((sum, item) => sum + item.tokens, 0)
    const otherRequests = otherProjects.reduce((sum, item) => sum + item.requests, 0)
    const otherPercentage = ((otherTotal / total) * 100).toFixed(1)

    if (otherTotal > 0) {
      result.push({
        name: 'Other',
        fullName: `Other (${otherProjects.length} projects)`,
        value: otherTotal,
        requests: otherRequests,
        color: '#6b7280', // gray
        percentage: otherPercentage,
      })
    }

    return result
  }, [data])

  const total = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0)
  }, [chartData])

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload

    return (
      <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--elevation-2)] p-3 text-[var(--text-sm)]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-[var(--radius-sm)]" style={{ backgroundColor: item.color }} />
          <span className="font-semibold text-[var(--color-text-primary)]" title={item.fullName || item.name}>{item.name}</span>
        </div>
        <div className="space-y-1 text-[var(--color-text-secondary)]">
          <div className="flex justify-between gap-4">
            <span>Tokens:</span>
            <span className="font-medium">{formatTokens(item.value)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Requests:</span>
            <span className="font-medium">{item.requests.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4 text-[var(--color-text-muted)]">
            <span>Percentage:</span>
            <span>{item.percentage}%</span>
          </div>
        </div>
      </div>
    )
  }

  // Custom legend - ensure colors match chart
  const renderLegend = (props: any) => {
    const { payload } = props
    return (
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 px-2">
        {payload.map((entry: any, index: number) => {
          const item = chartData[index]
          return (
            <div key={entry.value} className="flex items-center gap-2 text-xs" title={item.fullName || item.name}>
              <div
                className="w-3 h-3 rounded-[var(--radius-sm)] flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[var(--color-text-secondary)] truncate max-w-[120px]">{item.name}</span>
              <span className="text-[var(--color-text-muted)]">{item.percentage}%</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--color-text-muted)]">
        No project data available
      </div>
    )
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            animationDuration={500}
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={renderLegend} />

          {/* Center text showing total */}
          <text
            x="50%"
            y="45%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--color-text-primary)] text-lg font-semibold"
          >
            {formatTokens(total)}
          </text>
          <text
            x="50%"
            y="45%"
            dy={20}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--color-text-muted)] text-xs"
          >
            total tokens
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
