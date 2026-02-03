import { AppLayout } from '@/components/layout'
import { Link } from '@/components/ui/Link'
import {
  Settings,
  Puzzle,
  FileText,
  MessageSquare,
  Package,
  Activity,
} from 'lucide-react'

interface CategoryCard {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  items: string[]
  status: 'available' | 'coming-soon'
  href?: string
}

const categories: CategoryCard[] = [
  // --- AVAILABLE NOW ---
  {
    id: 'requests',
    title: 'Requests',
    description: 'View API requests proxied through Claude Code Proxy',
    icon: <Activity size={24} />,
    items: ['Request logs', 'Response data', 'Token usage', 'Latency'],
    status: 'available',
    href: '/requests',
  },
  {
    id: 'conversations',
    title: 'Conversations',
    description: 'Browse and search through your Claude Code conversation logs',
    icon: <MessageSquare size={24} />,
    items: ['Session transcripts', 'Message threads', 'Tool usage', 'Subagent calls'],
    status: 'available',
    href: '/conversations',
  },
  {
    id: 'extensions',
    title: 'Extensions Hub',
    description: 'View all extensions: agents, commands, skills, hooks, and MCP servers',
    icon: <Puzzle size={24} />,
    items: ['Agents', 'Commands', 'Skills', 'Hooks', 'MCP Servers'],
    status: 'available',
    href: '/extensions',
  },
  {
    id: 'plugins',
    title: 'Plugins & Marketplaces',
    description: 'Installed plugins, marketplaces, and plugin cache',
    icon: <Package size={24} />,
    items: ['Marketplaces', 'Installed plugins', 'Plugin components'],
    status: 'available',
    href: '/plugins',
  },
  {
    id: 'session-data',
    title: 'Session Data',
    description: 'Debug logs, todos, plans, and session environment data',
    icon: <FileText size={24} />,
    items: ['debug/ logs', 'todos/ states', 'plans/', 'session-env/'],
    status: 'available',
    href: '/session-data',
  },
  {
    id: 'settings',
    title: 'Settings',
    description: 'Configure dashboard preferences and view configuration',
    icon: <Settings size={24} />,
    items: ['Theme', 'API settings', 'Display preferences'],
    status: 'available',
    href: '/settings',
  },
]

function CategoryCardComponent({ category }: { category: CategoryCard }) {
  const isAvailable = category.status === 'available'

  const content = (
    <div
      className={`
        group relative p-5 rounded-lg border transition-all duration-200
        ${isAvailable
          ? 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg cursor-pointer bg-[var(--color-bg-secondary)]'
          : 'border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 opacity-75'
        }
      `}
    >
      {/* Status Badge */}
      {!isAvailable && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]">
          Coming Soon
        </span>
      )}

      {/* Icon and Title */}
      <div className="flex items-start gap-4 mb-3">
        <div className={`
          p-2.5 rounded-lg
          ${isAvailable
            ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] group-hover:bg-[var(--color-accent)]/20'
            : 'bg-[var(--color-bg-hover)] text-[var(--color-text-muted)]'
          }
        `}>
          {category.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`
            font-semibold text-base mb-1
            ${isAvailable ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}
          `}>
            {category.title}
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] line-clamp-2">
            {category.description}
          </p>
        </div>
      </div>

      {/* Items List */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {category.items.slice(0, 4).map((item) => (
          <span
            key={item}
            className={`
              px-2 py-0.5 text-xs rounded
              ${isAvailable
                ? 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)]'
              }
            `}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )

  if (isAvailable && category.href) {
    return (
      <Link href={category.href} className="block">
        {content}
      </Link>
    )
  }

  return content
}

export function HomePage() {
  return (
    <AppLayout
      title="Home"
      description="Claude Code Visualization Dashboard"
    >
      <div className="max-w-6xl mx-auto p-6">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-3">
            Claude Code Visualization Dashboard
          </h1>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Explore requests, conversations, extensions, and more from your Claude Code sessions
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          <QuickStat label="Sections" value={categories.length.toString()} />
          <QuickStat label="Available" value={categories.filter(c => c.status === 'available').length.toString()} />
          <QuickStat label="Data Sources" value="6+" />
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <CategoryCardComponent key={category.id} category={category} />
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <div className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{label}</div>
    </div>
  )
}
