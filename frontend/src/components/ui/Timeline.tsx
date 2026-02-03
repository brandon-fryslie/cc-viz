import { type FC, type ReactNode, useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface TimelineEvent {
  /**
   * Unique event ID
   */
  id: string
  /**
   * Event timestamp
   */
  timestamp: Date | string
  /**
   * Event title/label
   */
  title: string
  /**
   * Event description (optional)
   */
  description?: string
  /**
   * Event type (for filtering and styling)
   */
  type?: string
  /**
   * Custom icon component
   */
  icon?: ReactNode
  /**
   * Detailed content (expandable)
   */
  details?: ReactNode
}

export interface TimelineProps {
  /**
   * Timeline events
   */
  events: TimelineEvent[]
  /**
   * Filter by event type (optional)
   */
  filterType?: string
  /**
   * Callback when filter changes
   */
  onFilterChange?: (type: string | undefined) => void
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Timeline component for displaying chronological events with expandable details.
 *
 * @example
 * ```tsx
 * <Timeline
 *   events={[
 *     {
 *       id: '1',
 *       timestamp: new Date(),
 *       title: 'Request sent',
 *       type: 'http',
 *       details: <div>Request details...</div>
 *     }
 *   ]}
 * />
 * ```
 */
export const Timeline: FC<TimelineProps> = ({
  events,
  filterType,
  onFilterChange,
  className,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const filteredEvents = filterType
    ? events.filter((event) => event.type === filterType)
    : events

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const formatTimestamp = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // Get unique event types for filtering
  const eventTypes = Array.from(new Set(events.map((e) => e.type).filter(Boolean)))

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Filter controls */}
      {eventTypes.length > 0 && onFilterChange && (
        <div className="flex gap-2 mb-6">
          <button
            className={cn(
              'px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--text-sm)] font-medium transition-colors',
              !filterType
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            )}
            onClick={() => onFilterChange(undefined)}
          >
            All
          </button>
          {eventTypes.map((type) => (
            <button
              key={type}
              className={cn(
                'px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--text-sm)] font-medium transition-colors capitalize',
                filterType === type
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
              )}
              onClick={() => onFilterChange(type)}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--color-border)]" />

        {/* Events */}
        <div className="space-y-6">
          {filteredEvents.map((event) => {
            const isExpanded = expandedIds.has(event.id)
            const hasDetails = !!event.details

            return (
              <div key={event.id} className="relative pl-12">
                {/* Icon circle */}
                <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-[var(--color-bg-tertiary)] border-2 border-[var(--color-accent)] flex items-center justify-center text-[var(--color-accent)]">
                  {event.icon || (
                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                  )}
                </div>

                {/* Event card */}
                <div
                  className={cn(
                    'bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4',
                    hasDetails && 'cursor-pointer hover:border-[var(--color-border-hover)]'
                  )}
                  onClick={() => hasDetails && toggleExpanded(event.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[var(--text-base)] font-semibold text-[var(--color-text-primary)]">
                          {event.title}
                        </h3>
                        {event.type && (
                          <span className="px-2 py-0.5 bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] text-[var(--text-xs)] rounded-[var(--radius-sm)] capitalize">
                            {event.type}
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-muted)] mt-1">
                        {formatTimestamp(event.timestamp)}
                      </p>
                      {event.description && (
                        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                    {hasDetails && (
                      <button className="ml-2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded details */}
                  {hasDetails && isExpanded && (
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                      {event.details}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {filteredEvents.length === 0 && (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            No events found
          </div>
        )}
      </div>
    </div>
  )
}
