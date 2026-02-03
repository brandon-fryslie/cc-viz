# Implementation Context: All 6 Sprints

**Generated**: 2026-01-20
**Topic**: holistic-ui-revamp

This document provides shared implementation context for all 6 sprints.

---

## Technical Foundation

### Tech Stack
- **React 19.2.0** - Latest React with concurrent features
- **TanStack Query 5.90** - Data fetching with smart caching
- **TanStack Router 1.143** - Type-safe routing
- **TanStack Virtual 3.13** - Virtualization for large lists
- **Tailwind CSS 4.1** - Utility-first styling with @theme
- **Recharts 3.6** - Charting library
- **CVA 0.7** - Class variance authority for component variants

### Project Structure
```
frontend/src/
├── pages/           # Route pages (one per view)
├── components/
│   ├── ui/          # Design system base components
│   ├── features/    # Feature-specific components
│   ├── charts/      # Chart components (Recharts)
│   └── layout/      # Layout components (Sidebar, Panel)
├── lib/
│   ├── api.ts       # TanStack Query hooks
│   ├── utils.ts     # Utility functions
│   └── hooks/       # Custom React hooks
└── router.tsx       # Route definitions
```

---

## Existing Patterns to Follow

### Component Pattern (CVA)
```typescript
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:bg-accent/90',
        secondary: 'bg-bg-secondary text-text-primary hover:bg-bg-hover',
        ghost: 'hover:bg-bg-hover',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}
```

### Data Fetching Pattern
```typescript
import { useQuery } from '@tanstack/react-query'

export function useExtensions(filters?: ExtensionFilters) {
  return useQuery({
    queryKey: ['extensions', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.type) params.set('type', filters.type)
      const res = await fetch(`/api/v2/claude/extensions?${params}`)
      return res.json()
    },
    staleTime: 30_000, // 30 seconds
  })
}
```

### Virtualization Pattern
```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // row height
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }} className="relative">
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: virtualItem.start,
              height: virtualItem.size,
            }}
          >
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## API Endpoints Reference

### Sessions & Conversations
```
GET /api/v2/conversations              # List all conversations
GET /api/v2/conversations/:id          # Single conversation
GET /api/v2/conversations/:id/messages # Paginated messages
GET /api/v2/conversations/search       # FTS5 search
```

### Session Data (Todos & Plans)
```
GET /api/v2/claude/todos              # All todos
GET /api/v2/claude/todos/:sessionUuid # Todo by session
GET /api/v2/claude/todos/search       # Search todos
GET /api/v2/claude/plans              # All plans
GET /api/v2/claude/plans/:id          # Single plan
GET /api/v2/claude/plans/search       # Search plans
```

### Stats
```
GET /api/v2/stats                     # Weekly aggregates
GET /api/v2/stats/hourly              # Hourly breakdown
GET /api/v2/stats/models              # Model distribution
GET /api/v2/stats/providers           # Provider breakdown
GET /api/v2/stats/tools               # Tool usage
GET /api/v2/stats/performance         # Latency metrics
```

### Extensions
```
GET /api/v2/claude/extensions         # List all (with filters)
GET /api/v2/plugins                   # Installed plugins
GET /api/v2/marketplaces              # Available marketplaces
```

---

## Design Tokens Reference

### Colors (Dark Mode)
```css
--color-bg-primary: #0a0a0b;
--color-bg-secondary: #111113;
--color-bg-tertiary: #18181b;
--color-bg-hover: #1f1f23;
--color-bg-active: #27272a;
--color-border: #27272a;
--color-text-primary: #fafafa;
--color-text-secondary: #a1a1aa;
--color-text-muted: #71717a;
--color-accent: #3b82f6;
--color-success: #22c55e;
--color-warning: #eab308;
--color-error: #ef4444;
```

### Model Colors (for Charts)
```typescript
const MODEL_COLORS = {
  'claude-3-opus-20240229': '#9333ea',     // purple
  'claude-3-5-sonnet-20241022': '#3b82f6', // blue
  'claude-3-5-haiku-20241022': '#10b981',  // green
  'gpt-4o': '#f97316',                      // orange
  default: '#6b7280',                       // gray
}
```

---

## Common Utilities

### Format Tokens
```typescript
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`
  return `${(tokens / 1000000).toFixed(1)}M`
}
```

### Class Merge
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Relative Time
```typescript
export function timeAgo(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
```

---

## Beads Task IDs

| Epic | ID | Tasks |
|------|----|-------|
| Design System | cc-viz-3j1 | .1 through .6 |
| Mission Control | cc-viz-tqy | .1 through .6 |
| Session Timeline | cc-viz-bjd | .1 through .6 |
| Cockpit Split | cc-viz-0xr | .1 through .6 |
| Token Economics | cc-viz-89o | .1 through .6 |
| Extension Workshop | cc-viz-9dx | .1 through .6 |

---

## Quality Standards

### Code
- TypeScript strict mode (no any)
- Props interfaces with JSDoc
- Use design tokens (no hardcoded colors)
- Use CVA for variants
- Forward refs on interactive components

### Performance
- Virtualize lists >50 items
- Lazy load tab content
- Memoize expensive calculations
- Profile with React DevTools

### Accessibility
- Focus states on all interactive elements
- ARIA labels on icon-only buttons
- Keyboard navigation support
- Color contrast WCAG AA

### Testing
- Manual testing in Chrome, Firefox, Safari
- Test with real data (not mocked)
- Test both themes (dark/light)
- Test responsive breakpoints
