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
import { reindexExtensionsV3, useV3ExtensionDetail, useV3ExtensionsConfig } from '@/lib/api-v3'

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
      <Group justify="space-between">
        <div>
          <Title order={2}>Extensions & Config</Title>
          <Text c="dimmed">Unified view for extensions, plugins, and Claude configuration.</Text>
        </div>
        <Button loading={reindexing} onClick={onReindex}>Reindex</Button>
      </Group>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <Card withBorder>
            <Stack>
              <Text fw={600}>Filters</Text>
              <TextInput placeholder="Search" value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
              <Select
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
              <Select label="Source" value={sourceFilter} onChange={(value) => setSourceFilter(value || '')} data={[{ value: '', label: 'All' }, ...sourceOptions]} />
              <Select
                label="Enabled"
                value={enabledFilter}
                onChange={(value) => setEnabledFilter(value || '')}
                data={[{ value: '', label: 'All' }, { value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]}
              />
              <Select label="Plugin" value={pluginFilter} onChange={(value) => setPluginFilter(value || '')} data={[{ value: '', label: 'All' }, ...pluginOptions]} />
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 9 }}>
          <Card withBorder>
            {isLoading ? (
              <Text c="dimmed">Loading extensions...</Text>
            ) : (
              <ScrollArea h={560}>
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
        </Grid.Col>
      </Grid>

      <Card withBorder>
        <Tabs value={configTab} onChange={(value) => setConfigTab(value || 'claude_md')}>
          <Tabs.List>
            <Tabs.Tab value="claude_md">CLAUDE.md</Tabs.Tab>
            <Tabs.Tab value="settings">settings.json</Tabs.Tab>
            <Tabs.Tab value="mcp">MCP</Tabs.Tab>
            <Tabs.Tab value="plugins">Plugins</Tabs.Tab>
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
            <Code block>{JSON.stringify(data?.plugins || [], null, 2)}</Code>
          </Tabs.Panel>
        </Tabs>
      </Card>

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
