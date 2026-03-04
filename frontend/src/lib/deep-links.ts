export interface ParsedFocus {
  tab: string
  kind: string
  value: string
}

export function parseFocusFromSearch(search: string): ParsedFocus | null {
  const params = new URLSearchParams(search)
  const tab = params.get('tab') || 'messages'
  const focus = params.get('focus')
  if (!focus) return null

  const [kind, ...rest] = focus.split(':')
  if (!kind || rest.length === 0) return null

  return {
    tab,
    kind,
    value: rest.join(':'),
  }
}

export function routeFromSearchResult(item: Record<string, unknown>): string | null {
  const route = item.route
  if (typeof route !== 'string' || route.trim() === '') return null
  return route
}
