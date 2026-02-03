import { type FC } from 'react'
import { Tabs, type Tab } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { X, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ExtensionFiltersProps {
  /**
   * Current type filter ('all' or specific type)
   */
  typeFilter: string
  /**
   * Type filter change handler
   */
  onTypeFilterChange: (type: string) => void
  /**
   * Current status filter
   */
  statusFilter: 'all' | 'enabled' | 'disabled'
  /**
   * Status filter change handler
   */
  onStatusFilterChange: (status: 'all' | 'enabled' | 'disabled') => void
  /**
   * Current source filter
   */
  sourceFilter: string
  /**
   * Source filter change handler
   */
  onSourceFilterChange: (source: string) => void
  /**
   * Available sources
   */
  availableSources: string[]
  /**
   * Type counts for badge display
   */
  typeCounts: {
    all: number
    agent: number
    command: number
    skill: number
    hook: number
    mcp: number
  }
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * ExtensionFilters provides type tabs, status dropdown, and source dropdown filtering.
 */
export const ExtensionFilters: FC<ExtensionFiltersProps> = ({
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  sourceFilter,
  onSourceFilterChange,
  availableSources,
  typeCounts,
  className,
}) => {
  const typeTabs: Tab[] = [
    { value: 'all', label: 'All', count: typeCounts.all },
    { value: 'agent', label: 'Agents', count: typeCounts.agent },
    { value: 'command', label: 'Commands', count: typeCounts.command },
    { value: 'skill', label: 'Skills', count: typeCounts.skill },
    { value: 'hook', label: 'Hooks', count: typeCounts.hook },
    { value: 'mcp', label: 'MCP', count: typeCounts.mcp },
  ]

  const hasActiveFilters = statusFilter !== 'all' || sourceFilter !== 'all'

  const handleClearFilters = () => {
    onStatusFilterChange('all')
    onSourceFilterChange('all')
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Type Tabs */}
      <Tabs
        tabs={typeTabs}
        value={typeFilter}
        onChange={onTypeFilterChange}
      />

      {/* Status & Source Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--color-text-muted)]" />
          <span className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            Filters:
          </span>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'enabled' | 'disabled')}
          className={cn(
            'px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--text-sm)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)]',
            'hover:border-[var(--color-border-hover)] transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
          )}
        >
          <option value="all">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>

        {/* Source Filter */}
        <select
          value={sourceFilter}
          onChange={(e) => onSourceFilterChange(e.target.value)}
          className={cn(
            'px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--text-sm)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text-secondary)]',
            'hover:border-[var(--color-border-hover)] transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
          )}
        >
          <option value="all">All Sources</option>
          {availableSources.map((source) => (
            <option key={source} value={source}>
              {source === 'user' ? 'User' : source.startsWith('project:') ? 'Project' : source.split('@')[0]}
            </option>
          ))}
        </select>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="gap-1"
          >
            <X className="w-3 h-3" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {statusFilter !== 'all' && (
            <Badge variant="info" className="gap-1">
              Status: {statusFilter}
              <button
                onClick={() => onStatusFilterChange('all')}
                className="ml-1 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {sourceFilter !== 'all' && (
            <Badge variant="info" className="gap-1">
              Source: {sourceFilter === 'user' ? 'User' : sourceFilter.split('@')[0]}
              <button
                onClick={() => onSourceFilterChange('all')}
                className="ml-1 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
