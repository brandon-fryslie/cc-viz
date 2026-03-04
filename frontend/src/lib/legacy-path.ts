export function legacyAwarePath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (window.location.pathname.startsWith('/legacy')) {
    return `/legacy${normalized}`
  }
  return normalized
}
