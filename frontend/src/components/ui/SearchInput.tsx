import { type FC, useState, useEffect } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { Input } from './Input'

export interface SearchInputProps {
  /**
   * Placeholder text
   */
  placeholder?: string
  /**
   * Callback when search value changes (debounced)
   */
  onSearch: (value: string) => void
  /**
   * Debounce delay in milliseconds
   */
  debounceDelay?: number
  /**
   * Whether search is in a loading state
   */
  isLoading?: boolean
  /**
   * Initial value
   */
  initialValue?: string
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * SearchInput component with debounced search, clear button, and loading indicator.
 *
 * @example
 * ```tsx
 * <SearchInput
 *   placeholder="Search requests..."
 *   onSearch={(value) => console.log('Search:', value)}
 *   debounceDelay={300}
 *   isLoading={false}
 * />
 * ```
 */
export const SearchInput: FC<SearchInputProps> = ({
  placeholder = 'Search...',
  onSearch,
  debounceDelay = 300,
  isLoading = false,
  initialValue = '',
  className,
}) => {
  const [value, setValue] = useState(initialValue)
  const debouncedValue = useDebouncedValue(value, debounceDelay)

  // Call onSearch when debounced value changes
  useEffect(() => {
    onSearch(debouncedValue)
  }, [debouncedValue, onSearch])

  const handleClear = () => {
    setValue('')
  }

  return (
    <div className={cn('relative', className)}>
      {/* Search icon */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
        <Search className="w-4 h-4" />
      </div>

      {/* Input */}
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-10 pr-10"
      />

      {/* Loading indicator or clear button */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        {isLoading ? (
          <Loader2 className="w-4 h-4 text-[var(--color-accent)] animate-spin" />
        ) : value ? (
          <button
            onClick={handleClear}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
