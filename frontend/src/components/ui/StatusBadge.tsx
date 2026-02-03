import { type FC } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from './Badge'

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'

export interface StatusBadgeProps {
  /**
   * Status value
   */
  status: TodoStatus
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * StatusBadge component for displaying todo/task status with appropriate colors.
 *
 * @example
 * ```tsx
 * <StatusBadge status="pending" />
 * <StatusBadge status="in_progress" />
 * <StatusBadge status="completed" />
 * ```
 */
export const StatusBadge: FC<StatusBadgeProps> = ({ status, className }) => {
  const getVariant = (status: TodoStatus) => {
    switch (status) {
      case 'pending':
        return 'default'
      case 'in_progress':
        return 'info'
      case 'completed':
        return 'success'
      case 'blocked':
        return 'error'
      case 'cancelled':
        return 'default'
      default:
        return 'default'
    }
  }

  const getLabel = (status: TodoStatus) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  return (
    <Badge variant={getVariant(status)} className={cn(className)}>
      {getLabel(status)}
    </Badge>
  )
}
