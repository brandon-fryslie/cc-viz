import { useMemo, useState } from 'react'
import { Card, Grid, Group, SegmentedControl, Stack, Table, Text, Title } from '@mantine/core'
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Line, LineChart, BarChart, Bar } from 'recharts'
import { FreshnessBadges } from '@/components/live/FreshnessBadges'
import { useV3TokenProjects, useV3TokenSummary, useV3TokenTimeseries } from '@/lib/api-v3'
import { useListFreshness } from '@/lib/live/useListFreshness'
import { MotionCard, MotionPingPong, MotionSection } from '@/lib/motion/primitives'
import { useV3DateRange } from '@/lib/v3-date-range'

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function formatPercent(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`
}

export function TokenEconomicsPage() {
  const [bucket, setBucket] = useState<'day' | 'hour'>('day')
  const { start, end, preset } = useV3DateRange()

  const { data: summary, isLoading: summaryLoading } = useV3TokenSummary({ start, end })
  const { data: timeseries, isLoading: seriesLoading } = useV3TokenTimeseries({ start, end, bucket })
  const { data: projects, isLoading: projectsLoading } = useV3TokenProjects({ start, end })
  const summaryFreshness = useListFreshness(summary ? [summary] : [], {
    scopeKey: `token-summary-${start}-${end}`,
    getId: () => 'summary',
    getHash: (item) => [
      item.total_tokens,
      item.burn_rate_per_day,
      item.peak_day_tokens,
      item.trend_percent,
      item.peak_day_date || '',
      item.usage?.cache_read_input_tokens ?? 0,
      item.usage?.cache_creation_input_tokens ?? 0,
      item.prompt_cache?.cache_hit_rate_percent ?? 0,
      item.prompt_cache?.cache_write_rate_percent ?? 0,
    ].join('|'),
  })
  const projectFreshness = useListFreshness(projects?.projects, {
    scopeKey: `token-projects-${start}-${end}`,
    getId: (item) => item.name,
    getHash: (item) => [item.totalTokens, item.conversationCount, item.cacheReadTokens, item.cacheCreationTokens, item.cacheHitRatePercent, item.topConversations?.length ?? 0].join('|'),
  })
  const tokenPageFreshness = {
    // [LAW:one-source-of-truth] Page freshness is derived from summary/project sections.
    lastUpdatedAt: Math.max(summaryFreshness.lastUpdatedAt ?? 0, projectFreshness.lastUpdatedAt ?? 0) || null,
    newCount: summaryFreshness.newCount + projectFreshness.newCount,
    updatedCount: summaryFreshness.updatedCount + projectFreshness.updatedCount,
    removedCount: summaryFreshness.removedCount + projectFreshness.removedCount,
    getItemClassName: () => '',
  }

  const sortedProjects = useMemo(() => {
    return [...(projects?.projects || [])].sort((a, b) => b.totalTokens - a.totalTokens)
  }, [projects])

  return (
    <Stack>
      <MotionSection variant="spiral">
        <Group justify="space-between">
        <div>
          <Title order={2}>Token Economics</Title>
          <Text c="dimmed">Live token burn, trends, and top consumers ({preset}).</Text>
          <FreshnessBadges freshness={tokenPageFreshness} label="Page freshness" />
        </div>
        <SegmentedControl
          data={[{ label: 'Daily', value: 'day' }, { label: 'Hourly', value: 'hour' }]}
          value={bucket}
          onChange={(value) => setBucket(value as 'day' | 'hour')}
        />
        </Group>
      </MotionSection>

      <Grid>
        <Grid.Col span={{ base: 12, md: 4, lg: 2 }}>
          <MotionPingPong index={3} delay={0}>
            <Card withBorder className={summaryFreshness.getItemClassName('summary')}>
              <Text size="sm" c="dimmed">Total Tokens</Text>
              <Title order={3}>{summaryLoading ? '--' : formatTokens(summary?.total_tokens || 0)}</Title>
            </Card>
          </MotionPingPong>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4, lg: 2 }}>
          <MotionPingPong index={0} delay={0.1}>
            <Card withBorder className={summaryFreshness.getItemClassName('summary')}>
              <Text size="sm" c="dimmed">Burn / Day</Text>
              <Title order={3}>{summaryLoading ? '--' : formatTokens(summary?.burn_rate_per_day || 0)}</Title>
            </Card>
          </MotionPingPong>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4, lg: 2 }}>
          <MotionPingPong index={1} delay={0.2}>
            <Card withBorder className={summaryFreshness.getItemClassName('summary')}>
              <Text size="sm" c="dimmed">Peak Day</Text>
              <Title order={3}>{summaryLoading ? '--' : formatTokens(summary?.peak_day_tokens || 0)}</Title>
              <Text size="xs" c="dimmed">{summary?.peak_day_date || ''}</Text>
            </Card>
          </MotionPingPong>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4, lg: 2 }}>
          <MotionPingPong index={2} delay={0.3}>
            <Card withBorder className={summaryFreshness.getItemClassName('summary')}>
              <Text size="sm" c="dimmed">Trend</Text>
              <Title order={3}>{summaryLoading ? '--' : `${summary?.trend_percent || 0}%`}</Title>
            </Card>
          </MotionPingPong>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4, lg: 2 }}>
          <MotionPingPong index={4} delay={0.4}>
            <Card withBorder className={summaryFreshness.getItemClassName('summary')}>
              <Text size="sm" c="dimmed">Cache Hit Rate</Text>
              <Title order={3}>{summaryLoading ? '--' : formatPercent(summary?.prompt_cache.cache_hit_rate_percent)}</Title>
              <Text size="xs" c="dimmed">reads / total input</Text>
            </Card>
          </MotionPingPong>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4, lg: 2 }}>
          <MotionPingPong index={5} delay={0.5}>
            <Card withBorder className={summaryFreshness.getItemClassName('summary')}>
              <Text size="sm" c="dimmed">Uncached Input</Text>
              <Title order={3}>{summaryLoading ? '--' : formatTokens(summary?.prompt_cache.uncached_input_tokens || 0)}</Title>
              <Text size="xs" c="dimmed">write rate {formatPercent(summary?.prompt_cache.cache_write_rate_percent)}</Text>
            </Card>
          </MotionPingPong>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <MotionCard flavor="orbit" index={4}>
            <Card withBorder>
            <Text fw={600} mb="sm">Token Timeseries</Text>
            <div style={{ height: 340 }}>
              {seriesLoading ? (
                <Text c="dimmed">Loading chart...</Text>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeseries?.points || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="tokens" stroke="var(--mantine-color-blue-6)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cache_read_input_tokens" stroke="var(--mantine-color-teal-6)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cache_creation_input_tokens" stroke="var(--mantine-color-orange-6)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            </Card>
          </MotionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <MotionCard flavor="flip" index={5}>
            <Card withBorder>
            <Text fw={600} mb="sm">Project Breakdown</Text>
            <div style={{ height: 340 }}>
              {projectsLoading ? (
                <Text c="dimmed">Loading breakdown...</Text>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedProjects.slice(0, 8)} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip />
                    <Bar dataKey="totalTokens" fill="var(--mantine-color-indigo-6)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            </Card>
          </MotionCard>
        </Grid.Col>
      </Grid>

      <MotionCard flavor="tilt" index={6}>
        <Card withBorder>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Top Consumers</Text>
          <FreshnessBadges freshness={projectFreshness} label="Table" />
        </Group>
        <Table striped withTableBorder highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Project</Table.Th>
              <Table.Th>Conversations</Table.Th>
              <Table.Th>Tokens</Table.Th>
              <Table.Th>Cache Reads</Table.Th>
              <Table.Th>Cache Hit Rate</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedProjects.map((project) => (
              <Table.Tr key={project.name} className={projectFreshness.getItemClassName(project.name)}>
                <Table.Td>{project.name}</Table.Td>
                <Table.Td>{project.conversationCount}</Table.Td>
                <Table.Td>{formatTokens(project.totalTokens)}</Table.Td>
                <Table.Td>{formatTokens(project.cacheReadTokens)}</Table.Td>
                <Table.Td>{formatPercent(project.cacheHitRatePercent)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        </Card>
      </MotionCard>
    </Stack>
  )
}
