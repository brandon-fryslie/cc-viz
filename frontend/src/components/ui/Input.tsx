import { type InputHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Input variant styles using CVA
 */
const inputVariants = cva(
  // Base styles
  'w-full px-3 py-2 text-[var(--text-base)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border rounded-[var(--radius-md)] placeholder:text-[var(--color-text-placeholder)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-primary)] disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'border-[var(--color-border)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-accent)]',
        error: 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]',
      },
      size: {
        sm: 'h-8 text-[var(--text-sm)] px-2',
        md: 'h-10',
        lg: 'h-12 text-[var(--text-md)] px-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /**
   * Error message to display below the input
   */
  error?: string
  /**
   * Label for the input
   */
  label?: string
}

/**
 * Input component with support for text, search, and number types.
 *
 * @example
 * ```tsx
 * <Input placeholder="Enter text" />
 * <Input type="search" placeholder="Search..." />
 * <Input type="number" min={0} max={100} />
 * <Input variant="error" error="This field is required" />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, size, error, label, ...props }, ref) => {
    const hasError = !!error || variant === 'error'

    return (
      <div className="w-full">
        {label && (
          <label className="block text-[var(--text-sm)] font-medium text-[var(--color-text-secondary)] mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(inputVariants({ variant: hasError ? 'error' : variant, size, className }))}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-[var(--text-sm)] text-[var(--color-error)]">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
