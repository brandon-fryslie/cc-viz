import { useEffect, useRef } from 'react'

/**
 * Custom hook to handle search term highlighting in detail pages
 * Reads URL params, finds matching content, scrolls to it, and applies flash animation
 */
export function useSearchHighlight(
  contentLoaded: boolean,
  containerRef: React.RefObject<HTMLElement | null>
) {
  const hasHighlightedRef = useRef(false)

  useEffect(() => {
    // Only run once when content loads
    if (!contentLoaded || !containerRef.current || hasHighlightedRef.current) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const searchQuery = params.get('q')
    const shouldHighlight = params.get('highlight') === 'true'

    if (!shouldHighlight || !searchQuery) {
      return
    }

    hasHighlightedRef.current = true

    // Wait for DOM to settle
    setTimeout(() => {
      if (!containerRef.current) return

      const query = searchQuery.toLowerCase()
      const container = containerRef.current

      // Find all text nodes in the container
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      )

      const textNodes: Text[] = []
      let node: Node | null
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text)
      }

      // Search for the query in text nodes
      for (const textNode of textNodes) {
        const text = textNode.textContent || ''
        const lowerText = text.toLowerCase()
        const index = lowerText.indexOf(query)

        if (index !== -1) {
          // Found a match! Wrap it in a span with highlight class
          const before = text.substring(0, index)
          const match = text.substring(index, index + query.length)
          const after = text.substring(index + query.length)

          const span = document.createElement('span')
          span.className = 'search-highlight'
          span.textContent = match

          const fragment = document.createDocumentFragment()
          if (before) fragment.appendChild(document.createTextNode(before))
          fragment.appendChild(span)
          if (after) fragment.appendChild(document.createTextNode(after))

          textNode.parentNode?.replaceChild(fragment, textNode)

          // Scroll to the highlighted element
          span.scrollIntoView({ behavior: 'smooth', block: 'center' })

          // Only highlight the first match
          break
        }
      }
    }, 100)
  }, [contentLoaded, containerRef])
}
