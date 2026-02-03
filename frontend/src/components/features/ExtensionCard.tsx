import { type FC } from 'react'
import { type Extension } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import {
  Bot,
  Terminal,
  Sparkles,
  Webhook,
  Plug,
  ChevronRight,
} from 'lucide-react'

export interface ExtensionCardProps {
  extension: Extension
  onClick: () => void
  variant?: 'grid' | 'list'
}

/**
 * Get icon for extension type
 */
function getExtensionIcon(type: string) {
  switch (type) {
    case 'agent':
      return <Bot className="w-5 h-5" />
    case 'command':
      return <Terminal className="w-5 h-5" />
    case 'skill':
      return <Sparkles className="w-5 h-5" />
    case 'hook':
      return <Webhook className="w-5 h-5" />
    case 'mcp':
      return <Plug className="w-5 h-5" />
    default:
      return <Plug className="w-5 h-5" />
  }
}

/**
 * Get color for extension type badge
 */
function getTypeBadgeVariant(type: string): 'default' | 'success' | 'info' | 'warning' {
  switch (type) {
    case 'agent':
      return 'info'
    case 'command':
      return 'warning'
    case 'skill':
      return 'success'
    default:
      return 'default'
  }
}

/**
 * Get source display text
 */
function getSourceDisplay(source: string): string {
  if (source === 'user') return 'User'
  if (source.startsWith('project:')) return 'Project'
  // Format "plugin@marketplace" -> "Plugin"
  const parts = source.split('@')
  return parts[0] || source
}

/**
 * ExtensionCard displays a single extension with type badge, description, and enable/disable state.
 * Available in both grid and list variants.
 */
export const ExtensionCard: FC<ExtensionCardProps> = ({
  extension,
  onClick,
  variant = 'grid',
}) => {
  const isListView = variant === 'list'

  return (
    <Card
      variant="clickable"
      padding="none"
      onClick={onClick}
      className={cn(
        'group relative',
        !extension.enabled && 'opacity-60'
      )}
    >
      <div className={cn(
        'p-4',
        isListView && 'flex items-start gap-4'
      )}>
        {/* Icon */}
        <div className={cn(
          'flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-bg-hover)] text-[var(--color-accent)] mb-3 transition-colors group-hover:bg-[var(--color-accent)] group-hover:text-white',
          isListView ? 'w-12 h-12 flex-shrink-0' : 'w-10 h-10'
        )}>
          {getExtensionIcon(extension.type)}
        </div>

        {/* Content */}
        <div className={cn('flex-1 min-w-0', isListView && 'pt-1')}>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[var(--color-text-primary)] text-[var(--text-base)] mb-1 truncate">
                {extension.name}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getTypeBadgeVariant(extension.type)} size="sm">
                  {extension.type}
                </Badge>
                <Badge variant="default" size="sm">
                  {getSourceDisplay(extension.source)}
                </Badge>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0 mt-1" />
          </div>

          {/* Description */}
          <p className={cn(
            'text-[var(--text-sm)] text-[var(--color-text-muted)] leading-relaxed',
            isListView ? 'line-clamp-2' : 'line-clamp-3'
          )}>
            {extension.description || 'No description available'}
          </p>

          {/* List view additional info */}
          {isListView && (
            <div className="flex items-center gap-3 mt-3 text-[var(--text-xs)] text-[var(--color-text-muted)]">
              <span className={cn(
                'px-2 py-0.5 rounded-[var(--radius-sm)]',
                extension.enabled
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
              )}>
                {extension.enabled ? 'Enabled' : 'Disabled'}
              </span>
              {extension.file_path && (
                <span className="truncate">
                  {extension.file_path.split('/').pop()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
