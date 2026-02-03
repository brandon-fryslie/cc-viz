import { type ReactNode, useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import { Input } from './Input'
import { ChevronUp, ChevronDown } from 'lucide-react'

export interface Column<T> {
  /**
   * Column identifier (must match data field)
   */
  key: keyof T
  /**
   * Column header label
   */
  label: string
  /**
   * Column width (CSS value like "150px" or "auto")
   */
  width?: string
  /**
   * Custom render function for cell content
   */
  render?: (value: T[keyof T], item: T) => ReactNode
  /**
   * Whether this column is sortable
   */
  sortable?: boolean
}

export interface DataListProps<T> {
  /**
   * Data items to display
   */
  data: T[]
  /**
   * Column definitions
   */
  columns: Column<T>[]
  /**
   * Unique key field for each item
   */
  keyField: keyof T
  /**
   * Whether to show search/filter input
   */
  searchable?: boolean
  /**
   * Custom filter function (default: search all string fields)
   */
  filterFn?: (item: T, searchQuery: string) => boolean
  /**
   * Callback when an item is selected
   */
  onItemSelect?: (item: T) => void
  /**
   * Height of each row in pixels
   */
  rowHeight?: number
  /**
   * Container height (defaults to 600px)
   */
  height?: number
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * DataList is a virtualized table component with sorting, filtering, and keyboard navigation.
 * Handles 1000+ items efficiently using @tanstack/react-virtual.
 *
 * @example
 * ```tsx
 * <DataList
 *   data={requests}
 *   columns={[
 *     { key: 'id', label: 'ID', width: '100px' },
 *     { key: 'method', label: 'Method', width: '80px' },
 *     { key: 'url', label: 'URL', sortable: true },
 *   ]}
 *   keyField="id"
 *   searchable
 *   onItemSelect={(item) => console.log(item)}
 * />
 * ```
 */
export function DataList<T extends Record<string, unknown>>({
  data,
  columns,
  keyField,
  searchable = false,
  filterFn,
  onItemSelect,
  rowHeight = 48,
  height = 600,
  className,
}: DataListProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const parentRef = useRef<HTMLDivElement>(null)

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchQuery) return data

    const defaultFilter = (item: T, query: string) => {
      const lowerQuery = query.toLowerCase()
      return Object.values(item).some((value) =>
        String(value).toLowerCase().includes(lowerQuery)
      )
    }

    const filter = filterFn || defaultFilter
    return data.filter((item) => filter(item, searchQuery))
  }, [data, searchQuery, filterFn])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      if (aVal === bVal) return 0

      const comparison = aVal < bVal ? -1 : 1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sortColumn, sortDirection])

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: sortedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  })

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return

    if (sortColumn === column.key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column.key)
      setSortDirection('asc')
    }
  }

  const handleRowClick = (item: T, index: number) => {
    setSelectedIndex(index)
    onItemSelect?.(item)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sortedData.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, sortedData.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        if (selectedIndex >= 0) {
          onItemSelect?.(sortedData[selectedIndex])
        }
        break
    }
  }

  return (
    <div className={cn('flex flex-col', className)} onKeyDown={handleKeyDown} tabIndex={0}>
      {searchable && (
        <div className="mb-4">
          <Input
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden bg-[var(--color-bg-tertiary)]">
        {/* Header */}
        <div className="flex items-center bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] sticky top-0 z-10">
          {columns.map((column) => (
            <div
              key={String(column.key)}
              className={cn(
                'flex items-center px-4 py-3 text-[var(--text-sm)] font-semibold text-[var(--color-text-primary)]',
                column.sortable && 'cursor-pointer hover:bg-[var(--color-bg-hover)]'
              )}
              style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
              onClick={() => handleSort(column)}
            >
              <span>{column.label}</span>
              {column.sortable && sortColumn === column.key && (
                <span className="ml-1">
                  {sortDirection === 'asc' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Virtualized body */}
        <div ref={parentRef} style={{ height: `${height}px`, overflow: 'auto' }}>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = sortedData[virtualRow.index]
              const isSelected = selectedIndex === virtualRow.index

              return (
                <div
                  key={String(item[keyField])}
                  className={cn(
                    'flex items-center border-b border-[var(--color-border)] cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-[var(--color-bg-active)] border-[var(--color-accent)]'
                      : 'hover:bg-[var(--color-bg-hover)]'
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => handleRowClick(item, virtualRow.index)}
                >
                  {columns.map((column) => (
                    <div
                      key={String(column.key)}
                      className="px-4 py-3 text-[var(--text-sm)] text-[var(--color-text-secondary)] truncate"
                      style={{ width: column.width || 'auto', flex: column.width ? undefined : 1 }}
                    >
                      {column.render
                        ? column.render(item[column.key], item)
                        : String(item[column.key])}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {sortedData.length === 0 && (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          {searchQuery ? 'No results found' : 'No data available'}
        </div>
      )}
    </div>
  )
}
