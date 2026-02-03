import { type HTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Card variant styles using CVA
 */
const cardVariants = cva(
  // Base styles
  'rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] shadow-[var(--elevation-1)] transition-all',
  {
    variants: {
      variant: {
        default: '',
        hover: 'hover:border-[var(--color-border-hover)] hover:shadow-[var(--elevation-2)]',
        clickable: 'cursor-pointer hover:border-[var(--color-border-hover)] hover:shadow-[var(--elevation-2)] active:shadow-[var(--elevation-1)]',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
)

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

/**
 * Card container component.
 *
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>Title</CardHeader>
 *   <CardContent>Content goes here</CardContent>
 *   <CardFooter>Footer actions</CardFooter>
 * </Card>
 * ```
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding, className }))}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

/**
 * Card header slot
 */
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5', className)}
      {...props}
    />
  )
})

CardHeader.displayName = 'CardHeader'

/**
 * Card title component
 */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn(
        'text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)] leading-none tracking-tight',
        className
      )}
      {...props}
    />
  )
})

CardTitle.displayName = 'CardTitle'

/**
 * Card description component
 */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn('text-[var(--text-sm)] text-[var(--color-text-muted)]', className)}
      {...props}
    />
  )
})

CardDescription.displayName = 'CardDescription'

/**
 * Card content slot
 */
export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('pt-0', className)}
      {...props}
    />
  )
})

CardContent.displayName = 'CardContent'

/**
 * Card footer slot
 */
export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex items-center pt-4', className)}
      {...props}
    />
  )
})

CardFooter.displayName = 'CardFooter'
