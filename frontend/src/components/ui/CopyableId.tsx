import { type FC } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'

export interface CopyableIdProps {
  /**
   * The ID value to display and copy
   */
  value: string
  /**
   * Number of characters to show at start (default: 8)
   */
  startChars?: number
  /**
   * Number of characters to show at end (default: 4)
   */
  endChars?: number
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * CopyableId component with middle truncation and click-to-copy functionality.
 *
 * @example
 * ```tsx
 * <CopyableId value="550e8400-e29b-41d4-a716-446655440000" />
 * <CopyableId value="very-long-request-id-12345" startChars={6} endChars={3} />
 * ```
 */
export const CopyableId: FC<CopyableIdProps> = ({
  value,
  startChars = 8,
  endChars = 4,
  className,
}) => {
  const { copied, copy } = useCopyToClipboard()

  const truncatedValue =
    value.length > startChars + endChars + 3
      ? `${value.slice(0, startChars)}...${value.slice(-endChars)}`
      : value

  const handleCopy = () => {
    copy(value)
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-2 px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-active)] transition-colors font-mono text-[var(--text-sm)] text-[var(--color-text-secondary)]',
        className
      )}
      title={`Click to copy: ${value}`}
    >
      <span>{truncatedValue}</span>
      {copied ? (
        <Check className="w-3 h-3 text-[var(--color-success)]" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </button>
  )
}
