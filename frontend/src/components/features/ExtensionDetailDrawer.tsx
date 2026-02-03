import { type FC } from 'react'
import { type Extension } from '@/lib/types'
import { DetailDrawer } from '@/components/ui/DetailDrawer'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Bot,
  Terminal,
  Sparkles,
  Webhook,
  Plug,
  ExternalLink,
  FileCode,
  Folder,
  Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ExtensionDetailDrawerProps {
  extension: Extension | null
  isOpen: boolean
  onClose: () => void
  relatedExtensions: Extension[]
  onExtensionClick: (extension: Extension) => void
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
 * Format date for display
 */
function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Invalid date'
  }
}

/**
 * Get source display text
 */
function getSourceDisplay(source: string): string {
  if (source === 'user') return 'User Extension'
  if (source.startsWith('project:')) return `Project: ${source.slice(8)}`
  // Format "plugin@marketplace" -> "Plugin (Marketplace)"
  const parts = source.split('@')
  if (parts.length === 2) {
    return `${parts[0]} (${parts[1]})`
  }
  return source
}

/**
 * ExtensionDetailDrawer shows full extension information in a sliding drawer.
 */
export const ExtensionDetailDrawer: FC<ExtensionDetailDrawerProps> = ({
  extension,
  isOpen,
  onClose,
  relatedExtensions,
  onExtensionClick,
}) => {
  if (!extension) return null

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} width="480px">
      {/* Header */}
      <div className="space-y-4 mb-6">
        {/* Icon & Title */}
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-bg-hover)] text-[var(--color-accent)] flex-shrink-0">
            {getExtensionIcon(extension.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[var(--text-xl)] font-bold text-[var(--color-text-primary)] mb-2">
              {extension.name}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={getTypeBadgeVariant(extension.type)} size="md">
                {extension.type}
              </Badge>
              <Badge
                variant={extension.enabled ? 'success' : 'default'}
                size="md"
              >
                {extension.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <h3 className="text-[var(--text-base)] font-semibold text-[var(--color-text-primary)] mb-2">
          Description
        </h3>
        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed">
          {extension.description || 'No description available'}
        </p>
      </div>

      {/* Metadata */}
      <div className="mb-6 space-y-3">
        <h3 className="text-[var(--text-base)] font-semibold text-[var(--color-text-primary)] mb-3">
          Details
        </h3>

        {/* Source */}
        <div className="flex items-start gap-3">
          <Folder className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-0.5">
              Source
            </div>
            <div className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
              {getSourceDisplay(extension.source)}
            </div>
          </div>
        </div>

        {/* File Path */}
        <div className="flex items-start gap-3">
          <FileCode className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-0.5">
              File Path
            </div>
            <div className="text-[var(--text-sm)] text-[var(--color-text-secondary)] font-mono break-all">
              {extension.file_path}
            </div>
          </div>
        </div>

        {/* Created At */}
        {extension.created_at && (
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[var(--text-xs)] text-[var(--color-text-muted)] mb-0.5">
                Created
              </div>
              <div className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                {formatDate(extension.created_at)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mb-6 space-y-2">
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={() => {
            // Copy file path to clipboard
            navigator.clipboard.writeText(extension.file_path)
          }}
        >
          <FileCode className="w-4 h-4" />
          Copy File Path
        </Button>

        {extension.source === 'user' && (
          <Button
            variant="secondary"
            className="w-full justify-start"
            onClick={() => {
              // Open in default editor (if supported)
              window.open(`vscode://file${extension.file_path}`, '_blank')
            }}
          >
            <ExternalLink className="w-4 h-4" />
            Open in Editor
          </Button>
        )}
      </div>

      {/* Related Extensions */}
      {relatedExtensions.length > 0 && (
        <div>
          <h3 className="text-[var(--text-base)] font-semibold text-[var(--color-text-primary)] mb-3">
            Related Extensions
          </h3>
          <div className="space-y-2">
            {relatedExtensions.map((related) => (
              <button
                key={related.id}
                onClick={() => onExtensionClick(related)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]',
                  'hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-hover)] transition-all',
                  'text-left'
                )}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-bg-hover)] text-[var(--color-accent)] flex-shrink-0">
                  {getExtensionIcon(related.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[var(--text-sm)] text-[var(--color-text-primary)] truncate">
                    {related.name}
                  </div>
                  <div className="text-[var(--text-xs)] text-[var(--color-text-muted)]">
                    {related.type}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Metadata JSON (if available) */}
      {extension.metadata_json && Object.keys(extension.metadata_json).length > 0 && (
        <div className="mt-6">
          <h3 className="text-[var(--text-base)] font-semibold text-[var(--color-text-primary)] mb-3">
            Additional Metadata
          </h3>
          <pre className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--text-xs)] text-[var(--color-text-secondary)] overflow-x-auto">
            {JSON.stringify(extension.metadata_json, null, 2)}
          </pre>
        </div>
      )}
    </DetailDrawer>
  )
}
