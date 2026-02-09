import { type FC, useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useSearch } from '@/lib/SearchContext'
import { EverythingDropdown } from './EverythingDropdown'

/**
 * Get human-readable label for a search scope
 */
function getScopeLabel(scope: ReturnType<typeof useSearch>['scope']): string {
  switch (scope.kind) {
    case 'everything':
      return 'Everything'
    case 'conversations':
      return 'Conversations'
    case 'this-session':
      return `This Session: ${scope.sessionName}`
    case 'requests':
      return 'Requests'
  }
}

/**
 * ScopeChip - shows current scope, clickable to override to Everything, x to reset
 */
const ScopeChip: FC = () => {
  const { scope, isScopeOverridden, resetScope, openEverything } = useSearch()
  const label = getScopeLabel(scope)

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs rounded-full">
      <button
        onClick={openEverything}
        className="hover:underline"
        title="Click to search Everything"
      >
        {label}
      </button>
      {isScopeOverridden && (
        <button
          onClick={resetScope}
          className="hover:bg-[var(--color-accent)]/20 rounded-full p-0.5"
          title="Reset to auto scope"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

/**
 * SearchBar - persistent non-modal search bar in header
 * Displays in root layout header, auto-adjusts scope based on context
 */
export const SearchBar: FC = () => {
  const { query, setQuery, clearSearch, inputRef, isEverythingOpen } = useSearch()
  const [showDropdown, setShowDropdown] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Show dropdown when Everything scope is active and query is >= 2 chars
  useEffect(() => {
    setShowDropdown(isEverythingOpen && query.length >= 2)
  }, [isEverythingOpen, query])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <div className="relative flex items-center gap-2">
        {/* Search icon */}
        <Search size={14} className="absolute left-3 text-[var(--color-text-muted)] pointer-events-none" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          placeholder={query ? '' : 'Search (Cmd+K)'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 pl-9 pr-3 py-1.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
        />

        {/* Clear button */}
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 hover:bg-[var(--color-bg-hover)] rounded-full p-0.5"
            title="Clear search"
          >
            <X size={14} className="text-[var(--color-text-muted)]" />
          </button>
        )}

        {/* Scope chip */}
        <ScopeChip />
      </div>

      {/* Everything dropdown */}
      {showDropdown && <EverythingDropdown onClose={() => setShowDropdown(false)} />}
    </div>
  )
}
