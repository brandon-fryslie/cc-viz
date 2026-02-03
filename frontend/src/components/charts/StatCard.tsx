import { type FC, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { TrendIndicator } from './TrendIndicator'

export interface StatCardProps {
  /**
   * Card title
   */
  title: string
  /**
   * Main value to display (large text)
   */
  value: string | number
  /**
   * Optional subtitle or description
   */
  subtitle?: string
  /**
   * Optional icon to display in the top-right corner
   */
  icon?: ReactNode
  /**
   * Optional trend data
   */
  trend?: {
    /** Percentage change value */
    value: number
    /** Optional label (e.g., "vs last week") */
    label?: string
  }
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * StatCard component for displaying key metrics with optional trend indicators.
 * Refactored to use design tokens and the new Card component.
 *
 * @example
 * ```tsx
 * <StatCard
 *   title="Total Requests"
 *   value="1,234"
 *   trend={{ value: 15.5, label: "vs last week" }}
 *   icon={<Activity className="w-5 h-5" />}
 * />
 * ```
 */
export const StatCard: FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}) => {
  return (
    <Card
      className={cn('w-full', className)}
      variant="hover"
      padding="md"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-[var(--text-sm)] text-[var(--color-text-muted)] font-medium">
            {title}
          </div>
          <div className="text-[var(--text-2xl)] font-bold text-[var(--color-text-primary)] mt-1">
            {value}
          </div>
          {subtitle && (
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-1">
              {subtitle}
            </div>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-[var(--color-bg-hover)] rounded-[var(--radius-md)] text-[var(--color-text-muted)]">
            {icon}
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-3">
          <TrendIndicator value={trend.value} label={trend.label} />
        </div>
      )}
    </Card>
  )
}
