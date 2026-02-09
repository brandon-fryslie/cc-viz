import { useQuery } from '@tanstack/react-query'
import type {
  ConversationMatch,
  RequestSearchResult,
  ExtensionSearchResult,
  TodoSearchResult,
  PlanSearchResult
} from '@/lib/types'

const API_BASE = '/api/v2'

/**
 * Unified search result structure from backend API
 */
export interface UnifiedSearchResult {
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

export interface UseUnifiedSearchOptions {
  after?: string   // ISO date string for filtering by recency
  limit?: number   // Results per category
  enabled?: boolean // Whether to enable the query
}

/**
 * useUnifiedSearch - extracted from UnifiedSearchModal
 * Performs cross-type search via /api/v2/search endpoint
 */
export function useUnifiedSearch(
  query: string,
  options: UseUnifiedSearchOptions = {}
) {
  const { after = '', limit = 10, enabled = true } = options

  return useQuery({
    queryKey: ['unified-search', query, after, limit],
    queryFn: async () => {
      if (!query.trim() || query.length < 2) return null

      const params = new URLSearchParams()
      params.set('q', query)
      params.set('limit', limit.toString())
      if (after) params.set('after', after)

      const response = await fetch(`${API_BASE}/search?${params}`)
      if (!response.ok) throw new Error('Search failed')

      return response.json() as Promise<UnifiedSearchResult>
    },
    enabled: enabled && query.length >= 2,
  })
}
