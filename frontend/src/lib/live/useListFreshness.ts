import { useEffect, useMemo, useRef, useState } from 'react'

type FreshState = 'new' | 'updated'

interface FreshEntry {
  state: FreshState
  expiresAt: number
}

interface RemovedNotice {
  count: number
  expiresAt: number
}

interface FreshnessInternalState {
  entries: Record<string, FreshEntry>
  removedNotice: RemovedNotice | null
  lastUpdatedAt: number | null
}

interface UseListFreshnessOptions<T> {
  scopeKey: string
  getId: (item: T) => string
  getHash?: (item: T) => string
  ttlMs?: number
}

export interface ListFreshness {
  lastUpdatedAt: number | null
  newCount: number
  updatedCount: number
  removedCount: number
  getItemClassName: (id: string) => string
}

const EMPTY_ENTRIES: Record<string, FreshEntry> = {}

function buildMap<T>(items: T[], getId: (item: T) => string, getHash?: (item: T) => string): Map<string, string> {
  const next = new Map<string, string>()
  for (const item of items) {
    const id = getId(item)
    if (!id) continue
    next.set(id, getHash ? getHash(item) : JSON.stringify(item))
  }
  return next
}

function pruneExpiredEntries(entries: Record<string, FreshEntry>, now: number): Record<string, FreshEntry> {
  const pruned: Record<string, FreshEntry> = {}
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.expiresAt > now) {
      pruned[id] = entry
    }
  }
  return pruned
}

export function useListFreshness<T>(items: T[] | undefined, options: UseListFreshnessOptions<T>): ListFreshness {
  const ttlMs = options.ttlMs ?? 12_000
  const getIdRef = useRef(options.getId)
  const getHashRef = useRef(options.getHash)
  getIdRef.current = options.getId
  getHashRef.current = options.getHash

  const [state, setState] = useState<FreshnessInternalState>({
    entries: EMPTY_ENTRIES,
    removedNotice: null,
    lastUpdatedAt: null,
  })

  const baselineRef = useRef<Map<string, string>>(new Map())
  const initializedRef = useRef(false)

  useEffect(() => {
    initializedRef.current = false
    baselineRef.current = new Map()
    setState({ entries: EMPTY_ENTRIES, removedNotice: null, lastUpdatedAt: null })
  }, [options.scopeKey])

  const list = items ?? []

  useEffect(() => {
    const nextMap = buildMap(list, getIdRef.current, getHashRef.current)

    if (!initializedRef.current) {
      baselineRef.current = nextMap
      initializedRef.current = true
      return
    }

    const prevMap = baselineRef.current
    const newIDs: string[] = []
    const updatedIDs: string[] = []

    for (const [id, nextHash] of nextMap.entries()) {
      const prevHash = prevMap.get(id)
      if (!prevHash) {
        newIDs.push(id)
        continue
      }
      if (prevHash !== nextHash) {
        updatedIDs.push(id)
      }
    }

    let removedCount = 0
    for (const id of prevMap.keys()) {
      if (!nextMap.has(id)) {
        removedCount++
      }
    }

    baselineRef.current = nextMap
    if (newIDs.length === 0 && updatedIDs.length === 0 && removedCount === 0) {
      return
    }

    const now = Date.now()
    const nextExpiry = now + ttlMs

    setState((prev) => {
      const preserved = pruneExpiredEntries(prev.entries, now)
      for (const id of newIDs) {
        preserved[id] = { state: 'new', expiresAt: nextExpiry }
      }
      for (const id of updatedIDs) {
        preserved[id] = { state: 'updated', expiresAt: nextExpiry }
      }

      const removedNotice = removedCount > 0
        ? { count: removedCount, expiresAt: nextExpiry }
        : prev.removedNotice && prev.removedNotice.expiresAt > now
          ? prev.removedNotice
          : null

      return {
        entries: preserved,
        removedNotice,
        lastUpdatedAt: now,
      }
    })
  }, [list, ttlMs])

  useEffect(() => {
    const now = Date.now()
    const expiryTimes = Object.values(state.entries).map((entry) => entry.expiresAt)
    if (state.removedNotice) {
      expiryTimes.push(state.removedNotice.expiresAt)
    }
    const nextExpiry = expiryTimes.filter((value) => value > now).sort((a, b) => a - b)[0]
    if (!nextExpiry) return

    const timer = window.setTimeout(() => {
      const at = Date.now()
      setState((prev) => ({
        entries: pruneExpiredEntries(prev.entries, at),
        removedNotice: prev.removedNotice && prev.removedNotice.expiresAt > at ? prev.removedNotice : null,
        lastUpdatedAt: prev.lastUpdatedAt,
      }))
    }, Math.max(25, nextExpiry - now + 5))

    return () => window.clearTimeout(timer)
  }, [state.entries, state.removedNotice])

  const now = Date.now()
  const counts = useMemo(() => {
    let newCount = 0
    let updatedCount = 0
    for (const entry of Object.values(state.entries)) {
      if (entry.expiresAt <= now) continue
      if (entry.state === 'new') {
        newCount++
        continue
      }
      updatedCount++
    }
    const removedCount = state.removedNotice && state.removedNotice.expiresAt > now
      ? state.removedNotice.count
      : 0
    return { newCount, updatedCount, removedCount }
  }, [now, state.entries, state.removedNotice])

  const getItemClassName = (id: string): string => {
    const entry = state.entries[id]
    if (!entry || entry.expiresAt <= Date.now()) return ''
    return entry.state === 'new' ? 'fresh-flash-new' : 'fresh-flash-updated'
  }

  return {
    lastUpdatedAt: state.lastUpdatedAt,
    newCount: counts.newCount,
    updatedCount: counts.updatedCount,
    removedCount: counts.removedCount,
    getItemClassName,
  }
}
