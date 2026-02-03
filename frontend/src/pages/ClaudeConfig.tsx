import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout'
import { FileText, Settings, Server, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClaudeConfigResponse {
  settings?: {
    model?: string
    default_mode?: string
    permissions?: Record<string, string[]>
    plugins?: Record<string, unknown>
    raw?: unknown
  }
  settings_error?: string
  claude_md?: {
    content: string
    sections: Record<string, string>
  }
  claude_md_error?: string
  mcp_config?: {
    mcpServers?: Record<string, unknown>
  }
  mcp_config_error?: string
}

type TabId = 'claude_md' | 'settings' | 'mcp'

interface TabConfig {
  id: TabId
  label: string
  icon: React.ReactNode
}

const tabs: TabConfig[] = [
  { id: 'claude_md', label: 'CLAUDE.md', icon: <FileText size={16} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  { id: 'mcp', label: 'MCP Servers', icon: <Server size={16} /> },
]

function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="font-medium text-[var(--color-text-primary)]">{title}</span>
      </button>
      {isOpen && (
        <div className="p-4 bg-[var(--color-bg-primary)]">
          {children}
        </div>
      )}
    </div>
  )
}

function ClaudeMdView({ data }: { data: ClaudeConfigResponse }) {
  if (data.claude_md_error) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-600 dark:text-yellow-400">
        <p className="font-medium">CLAUDE.md not found</p>
        <p className="text-sm mt-1">{data.claude_md_error}</p>
      </div>
    )
  }

  if (!data.claude_md) {
    return (
      <div className="text-[var(--color-text-muted)]">
        No CLAUDE.md configuration found
      </div>
    )
  }

  const { content, sections } = data.claude_md
  const sectionNames = Object.keys(sections || {})

  return (
    <div className="space-y-4">
      {/* Sections overview */}
      {sectionNames.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {sectionNames.map((name) => (
            <span
              key={name}
              className="px-2 py-1 text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Full content */}
      <CollapsibleSection title="Full Content" defaultOpen={true}>
        <pre className="text-sm font-mono whitespace-pre-wrap text-[var(--color-text-secondary)] overflow-x-auto max-h-[60vh] overflow-y-auto p-4 bg-[var(--color-bg-tertiary)] rounded">
          {content}
        </pre>
      </CollapsibleSection>

      {/* Individual sections */}
      {sectionNames.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Parsed Sections</h3>
          {sectionNames.map((name) => (
            <CollapsibleSection key={name} title={name} defaultOpen={false}>
              <pre className="text-sm font-mono whitespace-pre-wrap text-[var(--color-text-secondary)] overflow-x-auto max-h-[40vh] overflow-y-auto p-3 bg-[var(--color-bg-tertiary)] rounded">
                {sections[name]}
              </pre>
            </CollapsibleSection>
          ))}
        </div>
      )}
    </div>
  )
}

function SettingsView({ data }: { data: ClaudeConfigResponse }) {
  if (data.settings_error) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-600 dark:text-yellow-400">
        <p className="font-medium">settings.json not found</p>
        <p className="text-sm mt-1">{data.settings_error}</p>
      </div>
    )
  }

  if (!data.settings) {
    return (
      <div className="text-[var(--color-text-muted)]">
        No settings.json configuration found
      </div>
    )
  }

  const { model, default_mode, permissions, plugins, raw } = data.settings

  return (
    <div className="space-y-4">
      {/* Quick overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
          <p className="text-xs text-[var(--color-text-muted)]">Default Model</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{model || 'Not set'}</p>
        </div>
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
          <p className="text-xs text-[var(--color-text-muted)]">Default Mode</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{default_mode || 'Not set'}</p>
        </div>
      </div>

      {/* Permissions */}
      {permissions && Object.keys(permissions).length > 0 && (
        <CollapsibleSection title="Permissions" defaultOpen={true}>
          <div className="space-y-2">
            {Object.entries(permissions).map(([key, values]) => (
              <div key={key} className="p-3 bg-[var(--color-bg-tertiary)] rounded">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">{key}</p>
                <div className="flex flex-wrap gap-1">
                  {(values as string[]).map((v, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 text-xs bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] rounded"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Plugins */}
      {plugins && Object.keys(plugins).length > 0 && (
        <CollapsibleSection title="Plugins" defaultOpen={true}>
          <pre className="text-sm font-mono text-[var(--color-text-secondary)] overflow-x-auto p-3 bg-[var(--color-bg-tertiary)] rounded">
            {JSON.stringify(plugins, null, 2)}
          </pre>
        </CollapsibleSection>
      )}

      {/* Raw JSON */}
      <CollapsibleSection title="Raw JSON" defaultOpen={false}>
        <pre className="text-sm font-mono text-[var(--color-text-secondary)] overflow-x-auto max-h-[50vh] overflow-y-auto p-3 bg-[var(--color-bg-tertiary)] rounded">
          {JSON.stringify(raw, null, 2)}
        </pre>
      </CollapsibleSection>
    </div>
  )
}

function McpView({ data }: { data: ClaudeConfigResponse }) {
  if (data.mcp_config_error) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-600 dark:text-yellow-400">
        <p className="font-medium">.mcp.json not found</p>
        <p className="text-sm mt-1">{data.mcp_config_error}</p>
      </div>
    )
  }

  if (!data.mcp_config) {
    return (
      <div className="text-[var(--color-text-muted)]">
        No MCP configuration found
      </div>
    )
  }

  const servers = data.mcp_config.mcpServers || {}
  const serverNames = Object.keys(servers)

  if (serverNames.length === 0) {
    return (
      <div className="text-[var(--color-text-muted)]">
        No MCP servers configured
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        {serverNames.length} MCP server{serverNames.length !== 1 ? 's' : ''} configured
      </p>

      {serverNames.map((name) => (
        <CollapsibleSection key={name} title={name} defaultOpen={true}>
          <pre className="text-sm font-mono text-[var(--color-text-secondary)] overflow-x-auto p-3 bg-[var(--color-bg-tertiary)] rounded">
            {JSON.stringify(servers[name], null, 2)}
          </pre>
        </CollapsibleSection>
      ))}
    </div>
  )
}

export function ClaudeConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>('claude_md')

  const { data, isLoading, refetch, isRefetching } = useQuery<ClaudeConfigResponse>({
    queryKey: ['claude-config'],
    queryFn: async () => {
      const response = await fetch('/api/v2/claude/config')
      if (!response.ok) throw new Error('Failed to fetch config')
      return response.json()
    },
    staleTime: 60000, // Cache for 1 minute
  })

  return (
    <AppLayout
      title="Claude Config"
      description="View Claude Code configuration files"
      activeItem="claude-config"
    >
      <div className="flex flex-col h-full">
        {/* Tabs Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px]',
                  activeTab === tab.id
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isRefetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
              Loading configuration...
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center h-32 text-[var(--color-text-muted)]">
              Failed to load configuration
            </div>
          ) : (
            <>
              {activeTab === 'claude_md' && <ClaudeMdView data={data} />}
              {activeTab === 'settings' && <SettingsView data={data} />}
              {activeTab === 'mcp' && <McpView data={data} />}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
