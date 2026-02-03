import { useState, useEffect } from 'react'
import { useExtensions, usePlugins, reindexExtensions } from '../lib/api'
import { AppLayout } from '../components/layout'
import type { Extension } from '../lib/types'

export function ExtensionsHubPage() {
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Get filters from URL
  const urlParams = new URLSearchParams(window.location.search)
  const typeFilter = urlParams.get('type') || ''
  const sourceFilter = urlParams.get('source') || ''
  const searchFilter = urlParams.get('search') || debouncedSearch

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Fetch data
  const { data: extensionsData, refetch } = useExtensions({
    type: typeFilter,
    source: sourceFilter,
    search: searchFilter,
  })
  const { data: pluginsData } = usePlugins()

  const extensions = extensionsData?.extensions || []
  const plugins = pluginsData?.plugins || []

  // Update URL when filters change
  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(window.location.search)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    const newUrl = `${window.location.pathname}?${newParams.toString()}`
    window.history.pushState({}, '', newUrl)
    window.location.search = newParams.toString() // Trigger re-render
  }

  // Handle reindex
  const handleReindex = async () => {
    await reindexExtensions()
    refetch()
  }

  // Build source options
  const sourceOptions = [
    { value: '', label: 'All Sources' },
    { value: 'user', label: 'User' },
    ...plugins.map((p) => ({ value: p.id, label: `${p.name} (${p.marketplace})` })),
  ]

  const typeOptions: Array<{ value: string; label: string }> = [
    { value: '', label: 'All Types' },
    { value: 'agent', label: 'Agents' },
    { value: 'command', label: 'Commands' },
    { value: 'skill', label: 'Skills' },
    { value: 'hook', label: 'Hooks' },
    { value: 'mcp', label: 'MCP Servers' },
  ]

  return (
    <AppLayout title="Extensions Hub">
      <div className="flex flex-col h-full">
        {/* Filters */}
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex gap-4 items-center">
            <select
              value={typeFilter}
              onChange={(e) => updateFilter('type', e.target.value)}
              className="border border-[var(--color-border)] rounded px-3 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => updateFilter('source', e.target.value)}
              className="border border-[var(--color-border)] rounded px-3 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
            >
              {sourceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search extensions (FTS5)..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.currentTarget.value)}
              className="border border-[var(--color-border)] rounded px-3 py-2 flex-1 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
            />

            <button
              onClick={handleReindex}
              className="px-4 py-2 bg-[var(--color-accent)] text-white rounded hover:opacity-90"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Result Count */}
        <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
          {extensions.length > 0 ? (
            <span>
              Showing {extensions.length} extension{extensions.length !== 1 ? 's' : ''}
              {extensionsData?._total && extensionsData._total > extensions.length && ` of ${extensionsData._total}`}
            </span>
          ) : (
            <span>No extensions found</span>
          )}
        </div>

        {/* Extensions List */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-bg-hover)] sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-[var(--color-text-primary)]">Type</th>
                <th className="px-4 py-2 text-left text-[var(--color-text-primary)]">Name</th>
                <th className="px-4 py-2 text-left text-[var(--color-text-primary)]">Source</th>
                <th className="px-4 py-2 text-left text-[var(--color-text-primary)]">Enabled</th>
                <th className="px-4 py-2 text-left text-[var(--color-text-primary)]">Description</th>
              </tr>
            </thead>
            <tbody>
              {extensions.map((ext) => (
                <tr
                  key={ext.id}
                  onClick={() => setSelectedExtension(ext)}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
                >
                  <td className="px-4 py-2">
                    <span className="px-2 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded text-xs">
                      {ext.type}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">{ext.name}</td>
                  <td className="px-4 py-2 text-[var(--color-text-secondary)]">
                    {ext.source === 'user' ? (
                      <span>User</span>
                    ) : (
                      <a
                        href={`/plugins?selected=${ext.source}`}
                        className="text-[var(--color-accent)] hover:underline"
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                      >
                        {ext.source}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {ext.enabled ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">✗</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-[var(--color-text-muted)] truncate max-w-md">
                    {ext.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Panel */}
        {selectedExtension && (
          <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-bg-secondary)] max-h-64 overflow-auto">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{selectedExtension.name}</h3>
              <button
                onClick={() => setSelectedExtension(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <p>
                <strong className="text-[var(--color-text-primary)]">Type:</strong> {selectedExtension.type}
              </p>
              <p>
                <strong className="text-[var(--color-text-primary)]">Source:</strong> {selectedExtension.source}
              </p>
              <p>
                <strong className="text-[var(--color-text-primary)]">File Path:</strong>{' '}
                <code className="bg-[var(--color-bg-hover)] px-1 rounded">{selectedExtension.file_path}</code>
              </p>
              <p>
                <strong className="text-[var(--color-text-primary)]">Description:</strong> {selectedExtension.description}
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
