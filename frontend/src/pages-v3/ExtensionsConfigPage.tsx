import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Code,
  Drawer,
  Grid,
  Group,
  ScrollArea,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { FreshnessBadges } from '@/components/live/FreshnessBadges'
import { reindexExtensionsV3, useV3ExtensionDetail, useV3ExtensionsConfig } from '@/lib/api-v3'
import { useListFreshness } from '@/lib/live/useListFreshness'
import { MotionCard, MotionSection } from '@/lib/motion/primitives'

interface ExtensionsConfigPageProps {
  type?: string
  id?: string
}

export function ExtensionsConfigPage({ type, id }: ExtensionsConfigPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const searchString = typeof (location as { searchStr?: string }).searchStr === 'string'
    ? (location as { searchStr?: string }).searchStr!
    : window.location.search
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString])
  const pluginParam = searchParams.get('plugin') || ''
  const configTabParam = searchParams.get('configTab') || 'claude_md'
  const configSection = searchParams.get('section') || ''

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [enabledFilter, setEnabledFilter] = useState<string>('')
  const [pluginFilter, setPluginFilter] = useState<string>(pluginParam)
  const [selected, setSelected] = useState<{ type: string; id: string } | null>(type && id ? { type, id } : null)
  const [configTab, setConfigTab] = useState<string>(configTabParam)
  const [reindexing, setReindexing] = useState(false)

  useEffect(() => {
    setPluginFilter(pluginParam)
  }, [pluginParam])

  useEffect(() => {
    setConfigTab(configTabParam)
  }, [configTabParam])

  useEffect(() => {
    if (type && id) {
      setSelected({ type, id })
    }
  }, [id, type])

  const { data, refetch, isLoading } = useV3ExtensionsConfig({
    q: search,
    type: typeFilter || undefined,
    source: sourceFilter || undefined,
    enabled: enabledFilter || undefined,
    plugin: pluginFilter || undefined,
  })

  const { data: detail } = useV3ExtensionDetail(selected?.type || null, selected?.id || null)
  const extensionFreshness = useListFreshness(data?.extensions, {
    scopeKey: `extensions-config-${typeFilter}-${sourceFilter}-${enabledFilter}-${pluginFilter}-${search}`,
    getId: (item) => item.id,
    getHash: (item) => [item.enabled, item.updated_at || '', item.source, item.type, item.plugin_id || ''].join('|'),
  })
  const pluginFreshness = useListFreshness(data?.plugins, {
    scopeKey: 'extensions-config-plugins',
    getId: (item) => item.id,
    getHash: (item) => [
      item.version,
      item.component_counts.agents,
      item.component_counts.commands,
      item.component_counts.skills,
      item.component_counts.hooks,
      item.component_counts.mcp,
    ].join('|'),
  })
  const pageFreshness = {
    // [LAW:one-source-of-truth] Page freshness aggregates extension/plugin freshness without duplicating mutation tracking.
    lastUpdatedAt: Math.max(extensionFreshness.lastUpdatedAt ?? 0, pluginFreshness.lastUpdatedAt ?? 0) || null,
    newCount: extensionFreshness.newCount + pluginFreshness.newCount,
    updatedCount: extensionFreshness.updatedCount + pluginFreshness.updatedCount,
    removedCount: extensionFreshness.removedCount + pluginFreshness.removedCount,
    getItemClassName: () => '',
  }

  const sourceOptions = useMemo(() => {
    const unique = Array.from(new Set((data?.extensions || []).map((ext) => ext.source))).sort()
    return unique.map((value) => ({ value, label: value }))
  }, [data])

  const pluginOptions = useMemo(() => {
    return (data?.plugins || []).map((plugin) => ({ value: plugin.id, label: plugin.name }))
  }, [data])

  const onReindex = async () => {
    setReindexing(true)
    try {
      await reindexExtensionsV3()
      await refetch()
    } finally {
      setReindexing(false)
    }
  }

  return (
    <Stack>
      <MotionSection>
        <Group justify="space-between">
        <div>
          <Title order={2}>Extensions & Config</Title>
          <Text c="dimmed">Unified view for extensions, plugins, and Claude configuration.</Text>
          <FreshnessBadges freshness={pageFreshness} label="Page freshness" />
        </div>
        <Button loading={reindexing} onClick={onReindex}>Reindex</Button>
        </Group>
      </MotionSection>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <MotionCard>
            <Card withBorder>
            <Stack>
              <Text fw={600}>Filters</Text>
              <TextInput
                id="extensions-config-query"
                name="extensions-config-query"
                placeholder="Search"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              <Select
                name="extensions-config-type"
                label="Type"
                value={typeFilter}
                onChange={(value) => setTypeFilter(value || '')}
                data={[
                  { value: '', label: 'All' },
                  { value: 'agent', label: 'Agent' },
                  { value: 'command', label: 'Command' },
                  { value: 'skill', label: 'Skill' },
                  { value: 'hook', label: 'Hook' },
                  { value: 'mcp', label: 'MCP' },
                ]}
              />
              <Select
                name="extensions-config-source"
                label="Source"
                value={sourceFilter}
                onChange={(value) => setSourceFilter(value || '')}
                data={[{ value: '', label: 'All' }, ...sourceOptions]}
              />
              <Select
                name="extensions-config-enabled"
                label="Enabled"
                value={enabledFilter}
                onChange={(value) => setEnabledFilter(value || '')}
                data={[{ value: '', label: 'All' }, { value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]}
              />
              <Select
                name="extensions-config-plugin"
                label="Plugin"
                value={pluginFilter}
                onChange={(value) => setPluginFilter(value || '')}
                data={[{ value: '', label: 'All' }, ...pluginOptions]}
              />
            </Stack>
            </Card>
          </MotionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 9 }}>
          <MotionCard>
            <Card withBorder>
            {isLoading ? (
              <Text c="dimmed">Loading extensions...</Text>
            ) : (
              <ScrollArea h={560}>
                <Group justify="space-between" mb="sm">
                  <Text fw={600}>Extensions</Text>
                  <FreshnessBadges freshness={extensionFreshness} label="Table" />
                </Group>
                <Table withTableBorder striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Source</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(data?.extensions || []).map((extension) => (
                      <Table.Tr
                        key={extension.id}
                        className={extensionFreshness.getItemClassName(extension.id)}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelected({ type: extension.type, id: extension.id })
                          navigate({ to: '/extensions-config/$type/$id', params: { type: extension.type, id: extension.id } })
                        }}
                      >
                        <Table.Td>{extension.name}</Table.Td>
                        <Table.Td><Badge variant="outline">{extension.type}</Badge></Table.Td>
                        <Table.Td>{extension.source}</Table.Td>
                        <Table.Td>
                          <Badge color={extension.enabled ? 'green' : 'gray'} variant="light">
                            {extension.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
            </Card>
          </MotionCard>
        </Grid.Col>
      </Grid>

      <MotionSection delay={0.1}>
        <Card withBorder>
        <Tabs value={configTab} onChange={(value) => setConfigTab(value || 'claude_md')}>
          <Tabs.List>
            <Tabs.Tab value="claude_md">CLAUDE.md</Tabs.Tab>
            <Tabs.Tab value="settings">settings.json</Tabs.Tab>
            <Tabs.Tab value="mcp">MCP</Tabs.Tab>
            <Tabs.Tab value="plugins">Plugins {pluginFreshness.newCount > 0 ? `(+${pluginFreshness.newCount})` : ''}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="claude_md" pt="sm">
            {configSection && configTab === 'claude_md' && <Text size="sm" c="dimmed">Section: {configSection}</Text>}
            <Code block>{JSON.stringify((data?.config as Record<string, unknown>)?.claude_md || {}, null, 2)}</Code>
          </Tabs.Panel>
          <Tabs.Panel value="settings" pt="sm">
            {configSection && configTab === 'settings' && <Text size="sm" c="dimmed">Section: {configSection}</Text>}
            <Code block>{JSON.stringify((data?.config as Record<string, unknown>)?.settings || {}, null, 2)}</Code>
          </Tabs.Panel>
          <Tabs.Panel value="mcp" pt="sm">
            {configSection && configTab === 'mcp' && <Text size="sm" c="dimmed">Section: {configSection}</Text>}
            <Code block>{JSON.stringify((data?.config as Record<string, unknown>)?.mcp || {}, null, 2)}</Code>
          </Tabs.Panel>
          <Tabs.Panel value="plugins" pt="sm">
            <FreshnessBadges freshness={pluginFreshness} label="Plugin inventory" />
            <Code block>{JSON.stringify(data?.plugins || [], null, 2)}</Code>
          </Tabs.Panel>
        </Tabs>
        </Card>
      </MotionSection>

      <Drawer
        opened={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Extension Detail"
        position="right"
        size="lg"
      >
        {detail ? (
          <Stack>
            <Badge variant="outline">{detail.extension.type}</Badge>
            <Title order={4}>{detail.extension.name}</Title>
            <Text>{detail.extension.description || 'No description'}</Text>
            <Text size="sm" c="dimmed">Source: {detail.extension.source}</Text>
            <Code block>{JSON.stringify(detail.extension, null, 2)}</Code>
            <Text fw={600}>Related</Text>
            <Code block>{JSON.stringify(detail.related, null, 2)}</Code>
          </Stack>
        ) : (
          <Text c="dimmed">No extension selected.</Text>
        )}
      </Drawer>
    </Stack>
  )
}
