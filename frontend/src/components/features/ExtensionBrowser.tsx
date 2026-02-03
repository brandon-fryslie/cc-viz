import { type FC } from 'react'
import { type Extension } from '@/lib/types'
import { ExtensionCard } from './ExtensionCard'
import { Button } from '@/components/ui/Button'
import { Grid3x3, List, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ExtensionBrowserProps {
  extensions: Extension[]
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onExtensionClick: (extension: Extension) => void
  isLoading?: boolean
  className?: string
}

/**
 * ExtensionBrowser displays extensions in grid or list view with a toggle button.
 */
export const ExtensionBrowser: FC<ExtensionBrowserProps> = ({
  extensions,
  viewMode,
  onViewModeChange,
  onExtensionClick,
  isLoading = false,
  className,
}) => {
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-20', className)}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            Loading extensions...
          </p>
        </div>
      </div>
    )
  }

  if (extensions.length === 0) {
    return (
      <div className={cn('flex items-center justify-center py-20', className)}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--color-bg-hover)] flex items-center justify-center">
            <Grid3x3 className="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>
          <h3 className="text-[var(--text-lg)] font-semibold text-[var(--color-text-primary)] mb-2">
            No extensions found
          </h3>
          <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
            Try adjusting your filters or search query to find extensions.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
          Showing {extensions.length} extension{extensions.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('grid')}
            className={cn(
              'h-7 px-2',
              viewMode === 'grid' && 'bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
            )}
            aria-label="Grid view"
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange('list')}
            className={cn(
              'h-7 px-2',
              viewMode === 'list' && 'bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]'
            )}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Extensions Grid/List */}
      <div className={cn(
        viewMode === 'grid'
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
          : 'flex flex-col gap-3'
      )}>
        {extensions.map((extension) => (
          <ExtensionCard
            key={extension.id}
            extension={extension}
            onClick={() => onExtensionClick(extension)}
            variant={viewMode}
          />
        ))}
      </div>
    </div>
  )
}
