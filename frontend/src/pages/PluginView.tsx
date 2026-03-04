import { useState } from 'react'
import { useMarketplaces } from '../lib/api'
import { AppLayout } from '../components/layout'
import type { Marketplace, Plugin } from '../lib/types'
import { ChevronRight, ChevronDown, Package } from 'lucide-react'
import { legacyAwarePath } from '@/lib/legacy-path'

export function PluginViewPage() {
  const urlParams = new URLSearchParams(window.location.search)
  const selectedPluginId = urlParams.get('selected') || ''

  const [expandedMarketplaces, setExpandedMarketplaces] = useState<Set<string>>(new Set())
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(
    selectedPluginId ? new Set([selectedPluginId]) : new Set()
  )

  const { data: marketplacesData, isLoading } = useMarketplaces()
  const marketplaces = marketplacesData?.marketplaces || []

  // Auto-expand marketplace if plugin is selected
  if (selectedPluginId && marketplacesData) {
    const marketplace = marketplaces.find((m) =>
      m.plugins?.some((p) => p.id === selectedPluginId)
    )
    if (marketplace && !expandedMarketplaces.has(marketplace.id)) {
      setExpandedMarketplaces(new Set([...expandedMarketplaces, marketplace.id]))
    }
  }

  const toggleMarketplace = (marketplaceId: string) => {
    const newExpanded = new Set(expandedMarketplaces)
    if (newExpanded.has(marketplaceId)) {
      newExpanded.delete(marketplaceId)
    } else {
      newExpanded.add(marketplaceId)
    }
    setExpandedMarketplaces(newExpanded)
  }

  const togglePlugin = (pluginId: string) => {
    const newExpanded = new Set(expandedPlugins)
    if (newExpanded.has(pluginId)) {
      newExpanded.delete(pluginId)
    } else {
      newExpanded.add(pluginId)
    }
    setExpandedPlugins(newExpanded)
  }

  if (isLoading) {
    return (
      <AppLayout title="Plugin View">
        <div className="flex items-center justify-center h-full">
          <div className="text-[var(--color-text-muted)]">Loading plugins...</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Plugin View">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Installed Plugins by Marketplace</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {marketplaces.length} marketplace{marketplaces.length !== 1 ? 's' : ''} •{' '}
            {marketplaces.reduce((sum, m) => sum + m.plugin_count, 0)} plugin
            {marketplaces.reduce((sum, m) => sum + m.plugin_count, 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-auto p-4">
          {marketplaces.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] py-8">
              No plugins installed
            </div>
          )}

          {marketplaces.map((marketplace) => (
            <div key={marketplace.id} className="mb-4">
              {/* Marketplace Header */}
              <div
                onClick={() => toggleMarketplace(marketplace.id)}
                className="flex items-center gap-2 p-3 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded cursor-pointer hover:bg-[var(--color-accent)]/20"
              >
                <div className="text-[var(--color-accent)]">
                  {expandedMarketplaces.has(marketplace.id) ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronRight size={20} />
                  )}
                </div>
                <Package size={18} className="text-[var(--color-accent)]" />
                <div className="flex-1">
                  <div className="font-semibold text-[var(--color-text-primary)]">{marketplace.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {marketplace.plugin_count} plugin{marketplace.plugin_count !== 1 ? 's' : ''} •{' '}
                    {marketplace.source_type}
                  </div>
                </div>
              </div>

              {/* Marketplace Content */}
              {expandedMarketplaces.has(marketplace.id) && (
                <div className="ml-6 mt-2 space-y-2">
                  {/* Marketplace Metadata */}
                  <div className="text-sm text-[var(--color-text-secondary)] pl-4 py-2 bg-[var(--color-bg-hover)] rounded">
                    <div>
                      <strong className="text-[var(--color-text-primary)]">Source:</strong> {marketplace.source_url}
                    </div>
                    <div>
                      <strong className="text-[var(--color-text-primary)]">Last Updated:</strong>{' '}
                      {new Date(marketplace.last_updated).toLocaleString()}
                    </div>
                    <div>
                      <strong className="text-[var(--color-text-primary)]">Auto-update:</strong> {marketplace.auto_update ? 'Yes' : 'No'}
                    </div>
                  </div>

                  {/* Plugins */}
                  {marketplace.plugins?.map((plugin) => (
                    <PluginNode
                      key={plugin.id}
                      plugin={plugin}
                      marketplace={marketplace}
                      expanded={expandedPlugins.has(plugin.id)}
                      selected={selectedPluginId === plugin.id}
                      onToggle={() => togglePlugin(plugin.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

interface PluginNodeProps {
  plugin: Plugin
  marketplace: Marketplace
  expanded: boolean
  selected: boolean
  onToggle: () => void
}

function PluginNode({ plugin, marketplace, expanded, selected, onToggle }: PluginNodeProps) {
  const { component_counts } = plugin
  const totalComponents =
    component_counts.agents +
    component_counts.commands +
    component_counts.skills +
    component_counts.hooks +
    component_counts.mcp

  return (
    <div
      className={`border rounded ml-4 ${
        selected ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'border-[var(--color-border)] bg-[var(--color-bg-primary)]'
      }`}
    >
      {/* Plugin Header */}
      <div
        onClick={onToggle}
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-[var(--color-bg-hover)]"
      >
        <div className="text-[var(--color-text-muted)]">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div className="flex-1">
          <div className="font-medium text-[var(--color-text-primary)]">
            {plugin.name}{' '}
            <span className="text-sm text-[var(--color-text-muted)]">({marketplace.name})</span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            {totalComponents} component{totalComponents !== 1 ? 's' : ''} • v{plugin.version}
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      {expanded && (
        <div className="px-6 py-3 bg-[var(--color-bg-hover)] border-t border-[var(--color-border)]">
          <div className="space-y-2">
            <ComponentLink
              type="agent"
              count={component_counts.agents}
              source={plugin.id}
            />
            <ComponentLink
              type="command"
              count={component_counts.commands}
              source={plugin.id}
            />
            <ComponentLink
              type="skill"
              count={component_counts.skills}
              source={plugin.id}
            />
            <ComponentLink
              type="hook"
              count={component_counts.hooks}
              source={plugin.id}
            />
            <ComponentLink
              type="mcp"
              count={component_counts.mcp}
              source={plugin.id}
              label="MCP Servers"
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface ComponentLinkProps {
  type: string
  count: number
  source: string
  label?: string
}

function ComponentLink({ type, count, source, label }: ComponentLinkProps) {
  if (count === 0) return null

  const displayLabel = label || `${type}s`.charAt(0).toUpperCase() + `${type}s`.slice(1)

  return (
    <a
      href={legacyAwarePath(`/extensions?type=${type}&source=${source}`)}
      className="flex items-center justify-between text-sm p-2 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] border border-transparent hover:border-[var(--color-accent)]/30"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <span>{displayLabel}</span>
      <span className="px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] rounded-full text-xs font-medium">
        {count}
      </span>
    </a>
  )
}
