import { type FC, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'

export interface ChartWrapperProps {
  /**
   * Chart title
   */
  title?: string
  /**
   * Chart description or subtitle
   */
  description?: string
  /**
   * Whether the chart is in a loading state
   */
  isLoading?: boolean
  /**
   * Error message to display
   */
  error?: string
  /**
   * Chart content (Recharts component)
   */
  children: ReactNode
  /**
   * Additional actions or controls to display in the header
   */
  actions?: ReactNode
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * ChartWrapper provides a consistent container for all charts with loading and error states.
 *
 * @example
 * ```tsx
 * <ChartWrapper title="Hourly Usage" description="Last 24 hours" isLoading={isLoading}>
 *   <LineChart data={data}>...</LineChart>
 * </ChartWrapper>
 * ```
 */
export const ChartWrapper: FC<ChartWrapperProps> = ({
  title,
  description,
  isLoading,
  error,
  children,
  actions,
  className,
}) => {
  return (
    <Card className={cn('w-full', className)} padding="lg">
      {(title || description || actions) && (
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        </CardHeader>
      )}

      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center h-[300px]">
            <div className="flex flex-col items-center gap-3">
              <svg
                className="animate-spin h-8 w-8 text-[var(--color-accent)]"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
                Loading chart...
              </span>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-center">
              <p className="text-[var(--color-error)] font-medium mb-2">Failed to load chart</p>
              <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <div className="w-full mt-4">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
