import { type FC, type ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from './Badge'

export interface Tab {
  /**
   * Unique tab identifier
   */
  value: string
  /**
   * Tab label
   */
  label: string
  /**
   * Optional badge count
   */
  count?: number
  /**
   * Optional icon
   */
  icon?: ReactNode
}

export interface TabsProps {
  /**
   * Array of tab definitions
   */
  tabs: Tab[]
  /**
   * Currently active tab value
   */
  value: string
  /**
   * Callback when tab changes
   */
  onChange: (value: string) => void
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Tabs component with horizontal layout, active indicator, badge counts, and keyboard navigation.
 *
 * @example
 * ```tsx
 * <Tabs
 *   tabs={[
 *     { value: 'all', label: 'All', count: 42 },
 *     { value: 'pending', label: 'Pending', count: 12 },
 *     { value: 'completed', label: 'Completed', count: 30 },
 *   ]}
 *   value={activeTab}
 *   onChange={setActiveTab}
 * />
 * ```
 */
export const Tabs: FC<TabsProps> = ({ tabs, value, onChange, className }) => {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Update indicator position when active tab changes
  useEffect(() => {
    const activeTabElement = tabRefs.current.get(value)
    if (activeTabElement) {
      setIndicatorStyle({
        left: activeTabElement.offsetLeft,
        width: activeTabElement.offsetWidth,
      })
    }
  }, [value, tabs])

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex = currentIndex

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
        break
      case 'ArrowRight':
        e.preventDefault()
        nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
        break
      case 'Home':
        e.preventDefault()
        nextIndex = 0
        break
      case 'End':
        e.preventDefault()
        nextIndex = tabs.length - 1
        break
      default:
        return
    }

    onChange(tabs[nextIndex].value)
    tabRefs.current.get(tabs[nextIndex].value)?.focus()
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className="flex items-center gap-1 border-b border-[var(--color-border)]"
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const isActive = value === tab.value

          return (
            <button
              key={tab.value}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(tab.value, el)
                } else {
                  tabRefs.current.delete(tab.value)
                }
              }}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2.5 text-[var(--text-sm)] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded-t-[var(--radius-md)]',
                isActive
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
              )}
              onClick={() => onChange(tab.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <Badge
                  size="sm"
                  variant={isActive ? 'info' : 'default'}
                  className="ml-1"
                >
                  {tab.count}
                </Badge>
              )}
            </button>
          )
        })}
      </div>

      {/* Active indicator */}
      <div
        className="absolute bottom-0 h-0.5 bg-[var(--color-accent)] transition-all duration-[var(--duration-base)] ease-out"
        style={{
          left: `${indicatorStyle.left}px`,
          width: `${indicatorStyle.width}px`,
        }}
      />
    </div>
  )
}
