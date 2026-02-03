import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import type {
  ConversationMatch,
  RequestSearchResult,
  ExtensionSearchResult,
  TodoSearchResult,
  PlanSearchResult
} from '@/lib/types'

const API_BASE = '/api/v2'

interface UnifiedSearchResult {
  query: string
  requests?: {
    results: RequestSearchResult[]
    total: number
  }
  conversations?: {
    results: ConversationMatch[]
    total: number
  }
  extensions?: {
    results: ExtensionSearchResult[]
    total: number
  }
  todos?: {
    results: TodoSearchResult[]
    total: number
  }
  plans?: {
    results: PlanSearchResult[]
    total: number
  }
}

interface UnifiedSearchModalProps {
  isOpen: boolean
  onClose: () => void
}

// Highlight snippet using backend-provided offsets
function highlightSnippet(snippet: string, start: number, end: number): React.ReactNode {
  if (!snippet) return ''
  if (start === 0 && end === 0) return snippet

  return (
    <span>
      {snippet.substring(0, start)}
      <span className="bg-[var(--color-accent)] text-white px-0.5 rounded font-medium">
        {snippet.substring(start, end)}
      </span>
      {snippet.substring(end)}
    </span>
  )
}

// Middle truncation for UUIDs
function truncateMiddle(uuid: string): string {
  if (!uuid || uuid.length <= 12) return uuid
  return `${uuid.substring(0, 4)}...${uuid.substring(uuid.length - 4)}`
}

// Get title for result
function getResultTitle(item: any, type: string): string {
  switch (type) {
    case 'conversation':
      return item.projectName || 'Conversation'
    case 'request':
      return item.model || 'Request'
    case 'extension':
      return item.name || 'Extension'
    case 'todo':
      return item.snippet?.substring(0, 50) || 'Todo'
    case 'plan':
      return item.display_name || item.file_name || 'Plan'
    default:
      return 'Result'
  }
}

// Get URL for navigation (P9)
function getResultUrl(item: any, type: string, searchQuery: string): string {
  const q = encodeURIComponent(searchQuery)

  switch (type) {
    case 'conversation':
      return `/conversations/${item.conversationId}?q=${q}&highlight=true`
    case 'request':
      return `/requests/${item.requestId}?q=${q}&highlight=true`
    case 'extension':
      return `/extensions?id=${item.id}`
    case 'todo':
      return `/session-data?session=${item.session_uuid}&todo=${item.id}`
    case 'plan':
      return `/session-data?session=${item.session_uuid || ''}&plan=${item.id}`
    default:
      return '/'
  }
}

export function UnifiedSearchModal({ isOpen, onClose }: UnifiedSearchModalProps) {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'conversations' | 'extensions' | 'todos' | 'plans'>('all')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Fetch unified search results
  const { data: results, isLoading } = useQuery({
    queryKey: ['unified-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) return null

      const params = new URLSearchParams()
      params.set('q', searchQuery)
      params.set('limit', '10')

      const response = await fetch(`${API_BASE}/search?${params}`)
      if (!response.ok) throw new Error('Search failed')

      return response.json() as Promise<UnifiedSearchResult>
    },
    enabled: isOpen && searchQuery.length >= 2,
  })

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Shift+K or Ctrl+Shift+K to toggle modal
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        onClose()
      }
      // Escape to close
      if (e.key === 'Escape') {
        onClose()
      }
      // Arrow keys to navigate
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => prev + 1)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(0, prev - 1))
      }
      // Enter to select
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSelectResult(selectedIndex)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, selectedIndex])

  // Collect all visible results
  const getAllVisibleResults = (): Array<{ item: any; type: string }> => {
    if (!results) return []

    let allResults: Array<{ item: any; type: string }> = []

    if (activeTab === 'all' || activeTab === 'requests') {
      allResults.push(...(results.requests?.results || []).map(r => ({ item: r, type: 'request' })))
    }
    if (activeTab === 'all' || activeTab === 'conversations') {
      allResults.push(...(results.conversations?.results || []).map(r => ({ item: r, type: 'conversation' })))
    }
    if (activeTab === 'all' || activeTab === 'extensions') {
      allResults.push(...(results.extensions?.results || []).map(r => ({ item: r, type: 'extension' })))
    }
    if (activeTab === 'all' || activeTab === 'todos') {
      allResults.push(...(results.todos?.results || []).map(r => ({ item: r, type: 'todo' })))
    }
    if (activeTab === 'all' || activeTab === 'plans') {
      allResults.push(...(results.plans?.results || []).map(r => ({ item: r, type: 'plan' })))
    }

    return allResults
  }

  const handleSelectResult = (index: number) => {
    const results = getAllVisibleResults()
    if (index >= 0 && index < results.length) {
      const { item, type } = results[index]
      const url = getResultUrl(item, type, searchQuery)
      navigate({ to: url })
      onClose()
    }
  }

  const handleCopySessionUUID = (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(uuid)
    setCopyFeedback(uuid)
    setTimeout(() => setCopyFeedback(null), 2000)
  }

  if (!isOpen) return null

  const getTabCount = (tab: string): number => {
    if (!results) return 0
    switch (tab) {
      case 'requests':
        return results.requests?.total || 0
      case 'conversations':
        return results.conversations?.total || 0
      case 'extensions':
        return results.extensions?.total || 0
      case 'todos':
        return results.todos?.total || 0
      case 'plans':
        return results.plans?.total || 0
      case 'all':
        return (
          (results.requests?.total || 0) +
          (results.conversations?.total || 0) +
          (results.extensions?.total || 0) +
          (results.todos?.total || 0) +
          (results.plans?.total || 0)
        )
      default:
        return 0
    }
  }

  const renderResults = () => {
    if (!searchQuery.trim()) {
      return (
        <div className="p-8 text-center text-[var(--color-text-muted)]">
          <p className="text-sm mb-2">Type to search across all data</p>
          <p className="text-xs text-[var(--color-text-muted)]/50">Press Cmd+Shift+K or Ctrl+Shift+K to toggle search</p>
        </div>
      )
    }

    if (isLoading) {
      return (
        <div className="p-4 text-center">
          <div className="inline-block animate-spin">⏳</div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Searching...</p>
        </div>
      )
    }

    const allResults = getAllVisibleResults()
    if (allResults.length === 0) {
      return (
        <div className="p-8 text-center text-[var(--color-text-muted)]">
          No results found
        </div>
      )
    }

    const renderItem = (item: any, type: string, idx: number) => {
      const isSelected = idx === selectedIndex
      const snippet = item.snippet || item.preview || ''
      const highlightStart = item.highlightStart ?? 0
      const highlightEnd = item.highlightEnd ?? 0
      const sessionUUID = item.session_uuid || null

      return (
        <div
          key={`${type}-${idx}`}
          onClick={() => {
            setSelectedIndex(idx)
            handleSelectResult(idx)
          }}
          className={`px-4 py-3 hover:bg-[var(--color-accent)]/20 cursor-pointer border-b border-[var(--color-border)]/30 transition-colors ${
            isSelected ? 'bg-[var(--color-accent)]/30' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xs px-2 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded whitespace-nowrap mt-0.5">
              {type}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {getResultTitle(item, type)}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                {highlightSnippet(snippet, highlightStart, highlightEnd)}
              </div>
              {sessionUUID && (
                <button
                  onClick={(e) => handleCopySessionUUID(e, sessionUUID)}
                  className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] mt-1 transition-colors"
                  title={`Click to copy: ${sessionUUID}`}
                >
                  {truncateMiddle(sessionUUID)}
                  {copyFeedback === sessionUUID && (
                    <span className="ml-2 text-green-600">✓ Copied</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div ref={resultsRef} className="overflow-y-auto max-h-96">
        {allResults.map(({ item, type }, idx) => renderItem(item, type, idx))}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-2xl shadow-lg rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
        {/* Search Input */}
        <div className="p-4 border-b border-[var(--color-border)]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search requests, conversations, extensions, todos, plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-lg outline-none"
          />
        </div>

        {/* Tabs */}
        {results && getTabCount('all') > 0 && (
          <div className="flex gap-1 px-4 pt-3 border-b border-[var(--color-border)] overflow-x-auto">
            {[
              { id: 'all' as const, label: 'All' },
              { id: 'requests' as const, label: 'Requests' },
              { id: 'conversations' as const, label: 'Conversations' },
              { id: 'extensions' as const, label: 'Extensions' },
              { id: 'todos' as const, label: 'Todos' },
              { id: 'plans' as const, label: 'Plans' },
            ].map(({ id, label }) => {
              const count = getTabCount(id)
              if (count === 0) return null
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-3 py-2 text-sm whitespace-nowrap rounded-t border-b-2 transition-colors ${
                    activeTab === id
                      ? 'text-[var(--color-accent)] border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                      : 'text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {label} <span className="text-xs text-[var(--color-text-muted)]">({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Results */}
        {renderResults()}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex justify-between">
          <span>Press Esc to close</span>
          <span>Cmd+Shift+K to toggle</span>
        </div>
      </div>
    </div>
  )
}
