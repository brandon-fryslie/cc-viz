import { type FC } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TrendIndicatorProps {
  /**
   * Percentage change value (positive, negative, or zero)
   */
  value: number
  /**
   * Optional label to display next to the trend
   */
  label?: string
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * TrendIndicator component for displaying trends with icons and colors.
 *
 * @example
 * ```tsx
 * <TrendIndicator value={15.5} label="vs last week" />
 * <TrendIndicator value={-8.2} />
 * <TrendIndicator value={0} />
 * ```
 */
export const TrendIndicator: FC<TrendIndicatorProps> = ({ value, label, className }) => {
  const isPositive = value > 0
  const isNegative = value < 0

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  const colorClass = isPositive
    ? 'text-[var(--color-success)]'
    : isNegative
    ? 'text-[var(--color-error)]'
    : 'text-[var(--color-text-muted)]'

  return (
    <div className={cn('flex items-center gap-1 text-[var(--text-sm)]', colorClass, className)}>
      <Icon className="w-4 h-4" />
      <span className="font-medium">
        {isPositive ? '+' : ''}
        {value.toFixed(1)}%
      </span>
      {label && <span className="text-[var(--color-text-muted)]">{label}</span>}
    </div>
  )
}
