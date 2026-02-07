import { useState, useEffect, useRef, useMemo } from 'react'
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

type DatePreset = 'all' | 'today' | '3d' | '7d' | '30d'

const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'all', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: '3d', label: '3 days' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
]

function datePresetToAfter(preset: DatePreset): string {
  if (preset === 'all') return ''
  const now = new Date()
  const daysMap: Record<string, number> = { today: 0, '3d': 3, '7d': 7, '30d': 30 }
  const days = daysMap[preset] ?? 0
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - days)
  return d.toISOString()
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

// Extract a timestamp string from any result type
function getTimestamp(item: any, type: string): string | null {
  switch (type) {
    case 'conversation':
      return item.lastActivity || null
    case 'request':
      return item.timestamp || null
    case 'extension':
      return item.updatedAt || null
    case 'todo':
      return item.modifiedAt || null
    case 'plan':
      return item.modifiedAt || null
    default:
      return null
  }
}

// Format a timestamp as relative time (e.g. "2h ago", "3d ago")
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffDay > 30) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHour > 0) return `${diffHour}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'just now'
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

// Get URL for navigation
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
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const afterParam = datePresetToAfter(datePreset)

  // Fetch unified search results
  const { data: results, isLoading } = useQuery({
    queryKey: ['unified-search', searchQuery, afterParam],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) return null

      const params = new URLSearchParams()
      params.set('q', searchQuery)
      params.set('limit', '10')
      if (afterParam) params.set('after', afterParam)

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
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        onClose()
      }
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => prev + 1)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(0, prev - 1))
      }
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

  // Collect all visible results, sorted by match_count DESC then recency DESC
  const allVisibleResults = useMemo((): Array<{ item: any; type: string }> => {
    if (!results) return []

    let collected: Array<{ item: any; type: string }> = []

    if (activeTab === 'all' || activeTab === 'requests') {
      collected.push(...(results.requests?.results || []).map(r => ({ item: r, type: 'request' })))
    }
    if (activeTab === 'all' || activeTab === 'conversations') {
      collected.push(...(results.conversations?.results || []).map(r => ({ item: r, type: 'conversation' })))
    }
    if (activeTab === 'all' || activeTab === 'extensions') {
      collected.push(...(results.extensions?.results || []).map(r => ({ item: r, type: 'extension' })))
    }
    if (activeTab === 'all' || activeTab === 'todos') {
      collected.push(...(results.todos?.results || []).map(r => ({ item: r, type: 'todo' })))
    }
    if (activeTab === 'all' || activeTab === 'plans') {
      collected.push(...(results.plans?.results || []).map(r => ({ item: r, type: 'plan' })))
    }

    // Sort: match_count DESC, then recency DESC
    collected.sort((a, b) => {
      const countDiff = (b.item.matchCount ?? 0) - (a.item.matchCount ?? 0)
      if (countDiff !== 0) return countDiff

      const tsA = getTimestamp(a.item, a.type)
      const tsB = getTimestamp(b.item, b.type)
      const dateA = tsA ? new Date(tsA).getTime() : 0
      const dateB = tsB ? new Date(tsB).getTime() : 0
      return dateB - dateA
    })

    return collected
  }, [results, activeTab])

  const handleSelectResult = (index: number) => {
    if (index >= 0 && index < allVisibleResults.length) {
      const { item, type } = allVisibleResults[index]
      const url = getResultUrl(item, type, searchQuery)
      navigate({ to: url })
      onClose()
    }
  }

  const handleCopyText = (e: React.MouseEvent, text: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopyFeedback(text)
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
          <div className="inline-block animate-spin">&#x23F3;</div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">Searching...</p>
        </div>
      )
    }

    if (allVisibleResults.length === 0) {
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
      const timestamp = getTimestamp(item, type)
      const matchCount = item.matchCount ?? 0

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
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {getResultTitle(item, type)}
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                {highlightSnippet(snippet, highlightStart, highlightEnd)}
              </div>
              {type === 'conversation' && item.conversationId && (
                <button
                  onClick={(e) => handleCopyText(e, item.conversationId)}
                  className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] mt-1 transition-colors"
                  title={`Click to copy session: ${item.conversationId}`}
                >
                  session: {item.conversationId}
                  {copyFeedback === item.conversationId && (
                    <span className="ml-2 text-green-600">&#x2713; Copied</span>
                  )}
                </button>
              )}
              {type !== 'conversation' && item.session_uuid && (
                <button
                  onClick={(e) => handleCopyText(e, item.session_uuid)}
                  className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-accent)] mt-1 transition-colors"
                  title={`Click to copy: ${item.session_uuid}`}
                >
                  {item.session_uuid.substring(0, 4)}...{item.session_uuid.substring(item.session_uuid.length - 4)}
                  {copyFeedback === item.session_uuid && (
                    <span className="ml-2 text-green-600">&#x2713; Copied</span>
                  )}
                </button>
              )}
              {/* Relevancy info bar */}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--color-text-muted)]/60 font-mono">
                <span>{matchCount} {matchCount === 1 ? 'match' : 'matches'}</span>
                {timestamp && (
                  <span>{formatRelativeTime(timestamp)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div ref={resultsRef} className="overflow-y-auto max-h-96">
        {allVisibleResults.map(({ item, type }, idx) => renderItem(item, type, idx))}
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
          {/* Date filter chips */}
          <div className="flex gap-1.5 mt-2">
            {DATE_PRESETS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setDatePreset(id)}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  datePreset === id
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-accent)]/10 text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
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
