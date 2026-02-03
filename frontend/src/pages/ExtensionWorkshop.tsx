import { type FC, useState, useMemo } from 'react'
import { useExtensions } from '@/lib/api'
import { type Extension } from '@/lib/types'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'
import { ExtensionFilters } from '@/components/features/ExtensionFilters'
import { ExtensionBrowser } from '@/components/features/ExtensionBrowser'
import { ExtensionDetailDrawer } from '@/components/features/ExtensionDetailDrawer'
import { RefreshCw, Sparkles } from 'lucide-react'
import { reindexExtensions } from '@/lib/api'

/**
 * ExtensionWorkshop - VS Code extensions-style browser for Claude extensions.
 */
export const ExtensionWorkshop: FC = () => {
  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    // Load view preference from localStorage
    return (localStorage.getItem('extensionWorkshopViewMode') as 'grid' | 'list') || 'grid'
  })
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null)
  const [isReindexing, setIsReindexing] = useState(false)

  // Fetch extensions
  const { data, isLoading, refetch } = useExtensions()
  const extensions = data?.extensions || []

  // Save view mode preference
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('extensionWorkshopViewMode', mode)
  }

  // Calculate available sources
  const availableSources = useMemo(() => {
    const sources = new Set<string>()
    extensions.forEach((ext) => sources.add(ext.source))
    return Array.from(sources).sort()
  }, [extensions])

  // Calculate type counts
  const typeCounts = useMemo(() => {
    const counts = {
      all: extensions.length,
      agent: 0,
      command: 0,
      skill: 0,
      hook: 0,
      mcp: 0,
    }

    extensions.forEach((ext) => {
      switch (ext.type) {
        case 'agent':
          counts.agent++
          break
        case 'command':
          counts.command++
          break
        case 'skill':
          counts.skill++
          break
        case 'hook':
          counts.hook++
          break
        case 'mcp':
          counts.mcp++
          break
      }
    })

    return counts
  }, [extensions])

  // Filter extensions
  const filteredExtensions = useMemo(() => {
    return extensions.filter((ext) => {
      // Type filter
      if (typeFilter !== 'all' && ext.type !== typeFilter) return false

      // Status filter
      if (statusFilter === 'enabled' && !ext.enabled) return false
      if (statusFilter === 'disabled' && ext.enabled) return false

      // Source filter
      if (sourceFilter !== 'all' && ext.source !== sourceFilter) return false

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = ext.name.toLowerCase().includes(query)
        const matchesDescription = ext.description?.toLowerCase().includes(query)
        const matchesType = ext.type.toLowerCase().includes(query)
        const matchesSource = ext.source.toLowerCase().includes(query)

        if (!matchesName && !matchesDescription && !matchesType && !matchesSource) {
          return false
        }
      }

      return true
    })
  }, [extensions, typeFilter, statusFilter, sourceFilter, searchQuery])

  // Find related extensions (same source or same type)
  const relatedExtensions = useMemo(() => {
    if (!selectedExtension) return []

    return extensions
      .filter((ext) => {
        // Don't include the selected extension itself
        if (ext.id === selectedExtension.id) return false

        // Same source or same type
        return ext.source === selectedExtension.source || ext.type === selectedExtension.type
      })
      .slice(0, 5) // Limit to 5 related
  }, [selectedExtension, extensions])

  // Handle reindex
  const handleReindex = async () => {
    setIsReindexing(true)
    try {
      await reindexExtensions()
      await refetch()
    } catch (error) {
      console.error('Failed to reindex extensions:', error)
    } finally {
      setIsReindexing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--color-bg-primary)]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)]">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[var(--text-xl)] font-bold text-[var(--color-text-primary)]">
                Extension Workshop
              </h1>
              <p className="text-[var(--text-sm)] text-[var(--color-text-muted)]">
                Browse and manage your Claude extensions
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReindex}
            isLoading={isReindexing}
            disabled={isReindexing}
          >
            <RefreshCw className="w-4 h-4" />
            {isReindexing ? 'Reindexing...' : 'Reindex'}
          </Button>
        </div>

        {/* Search */}
        <SearchInput
          placeholder="Search extensions by name, description, type, or source..."
          onSearch={setSearchQuery}
          debounceDelay={300}
          isLoading={isLoading}
        />
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <ExtensionFilters
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
          availableSources={availableSources}
          typeCounts={typeCounts}
        />
      </div>

      {/* Extension Browser */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <ExtensionBrowser
          extensions={filteredExtensions}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onExtensionClick={setSelectedExtension}
          isLoading={isLoading}
        />
      </div>

      {/* Detail Drawer */}
      <ExtensionDetailDrawer
        extension={selectedExtension}
        isOpen={!!selectedExtension}
        onClose={() => setSelectedExtension(null)}
        relatedExtensions={relatedExtensions}
        onExtensionClick={setSelectedExtension}
      />
    </div>
  )
}

export default ExtensionWorkshop
