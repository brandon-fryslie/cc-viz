import { type HTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Badge variant styles using CVA
 */
const badgeVariants = cva(
  // Base styles
  'inline-flex items-center justify-center rounded-[var(--radius-full)] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)]',
        success: 'bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]',
        warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning)]',
        error: 'bg-[var(--color-error-bg)] text-[var(--color-error)] border border-[var(--color-error)]',
        info: 'bg-[var(--color-info-bg)] text-[var(--color-info)] border border-[var(--color-info)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-[var(--text-xs)]',
        md: 'px-2.5 py-1 text-[var(--text-sm)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Badge component for displaying status, labels, and counts.
 *
 * @example
 * ```tsx
 * <Badge>Default</Badge>
 * <Badge variant="success">Success</Badge>
 * <Badge variant="warning" size="sm">Warning</Badge>
 * <Badge variant="error">Error</Badge>
 * ```
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, className }))}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'
