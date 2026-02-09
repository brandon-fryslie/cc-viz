import { createContext, useContext, useState, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useQueryState, parseAsString } from 'nuqs'
import { useLocation } from '@tanstack/react-router'

/**
 * SearchScope type - defines the context-aware search scope
 */
export type SearchScope =
  | { kind: 'everything' }
  | { kind: 'conversations' }
  | { kind: 'this-session'; sessionId: string; sessionName: string }
  | { kind: 'requests' }

/**
 * SearchContext interface - [LAW:single-enforcer] keyboard shortcuts managed here
 */
export interface SearchContextValue {
  query: string                   // from nuqs ?q=
  scope: SearchScope              // derived or overridden
  isEverythingOpen: boolean       // dropdown visibility
  autoScope: SearchScope          // what the route would give
  isScopeOverridden: boolean
  setQuery: (q: string) => void
  setScope: (scope: SearchScope) => void
  resetScope: () => void          // revert to auto
  openEverything: () => void      // scope=everything + focus
  clearSearch: () => void         // clear all state
  inputRef: RefObject<HTMLInputElement | null>
}

const SearchContext = createContext<SearchContextValue | null>(null)

/**
 * Derive search scope from current route pathname
 */
function deriveScopeFromRoute(pathname: string): SearchScope {
  if (pathname === '/conversations') {
    return { kind: 'conversations' }
  }

  // Match conversation detail route: /conversations/$id
  const conversationMatch = pathname.match(/^\/conversations\/([^/?]+)/)
  if (conversationMatch) {
    const sessionId = decodeURIComponent(conversationMatch[1])
    // Session name can be extracted from conversation data, for now use ID
    return { kind: 'this-session', sessionId, sessionName: sessionId.substring(0, 8) }
  }

  if (pathname === '/requests' || pathname.startsWith('/requests/')) {
    return { kind: 'requests' }
  }

  return { kind: 'everything' }
}

/**
 * SearchProvider - manages search state, scope, and keyboard shortcuts
 * [LAW:single-enforcer] This is the single source of truth for search keyboard shortcuts
 */
export function SearchProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [query, setQuery] = useQueryState('q', parseAsString.withDefault(''))
  const [scopeOverride, setScopeOverride] = useState<SearchScope | null>(null)
  const [isEverythingOpen, setIsEverythingOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Derive scope from route
  const autoScope = deriveScopeFromRoute(location.pathname)

  // Effective scope: override takes precedence, otherwise auto-derived
  const scope = scopeOverride || autoScope
  const isScopeOverridden = scopeOverride !== null

  // Reset override when navigating to a different page
  useEffect(() => {
    if (scopeOverride) {
      // If we navigated to a different route, clear override
      // Exception: navigating within same scope type is OK
      if (scopeOverride.kind !== autoScope.kind) {
        setScopeOverride(null)
        setIsEverythingOpen(false)
      }
    }
  }, [location.pathname])

  // [LAW:single-enforcer] Global keyboard shortcuts - owned by SearchProvider
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Cmd+Shift+K: Open everything search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        openEverything()
        return
      }

      // Cmd+K: Focus search bar (keep current scope)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }

      // / (slash): Focus search bar when not in input
      if (e.key === '/' && !isInputFocused) {
        e.preventDefault()
        inputRef.current?.focus()
        return
      }

      // Esc: Clear search and reset scope when bar is focused
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        e.preventDefault()
        clearSearch()
        inputRef.current?.blur()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const setScope = (newScope: SearchScope) => {
    setScopeOverride(newScope)
  }

  const resetScope = () => {
    setScopeOverride(null)
    setIsEverythingOpen(false)
  }

  const openEverything = () => {
    setScopeOverride({ kind: 'everything' })
    setIsEverythingOpen(true)
    inputRef.current?.focus()
  }

  const clearSearch = () => {
    setQuery('')
    resetScope()
  }

  // Close dropdown when query is cleared
  useEffect(() => {
    if (query.length === 0) {
      setIsEverythingOpen(false)
    }
  }, [query])

  const value: SearchContextValue = {
    query,
    scope,
    isEverythingOpen,
    autoScope,
    isScopeOverridden,
    setQuery,
    setScope,
    resetScope,
    openEverything,
    clearSearch,
    inputRef,
  }

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}

/**
 * useSearch hook - access search context with guard
 */
export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider')
  }
  return context
}
