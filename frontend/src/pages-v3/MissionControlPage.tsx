import { Badge, Button, Card, Grid, Group, ScrollArea, Stack, Table, Text, Title } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { FreshnessBadges } from '@/components/live/FreshnessBadges'
import { useV3MissionActivity, useV3MissionControl } from '@/lib/api-v3'
import { useListFreshness } from '@/lib/live/useListFreshness'
import { MotionCard, MotionListItem, MotionSection } from '@/lib/motion/primitives'
import { useV3DateRange } from '@/lib/v3-date-range'

export function MissionControlPage() {
  const navigate = useNavigate()
  const { start, end, preset } = useV3DateRange()
  const { data, isLoading } = useV3MissionControl({ start, end })
  const { data: activityData, isLoading: activityLoading } = useV3MissionActivity(40)
  const hotSessionFreshness = useListFreshness(data?.hot_sessions, {
    scopeKey: 'mission-control-hot-sessions',
    getId: (item) => item.id,
    getHash: (item) => [item.message_count, item.todo_count, item.conversation_count, item.agent_count].join('|'),
  })
  const activityFreshness = useListFreshness(activityData?.events, {
    scopeKey: 'mission-control-activity',
    getId: (item) => item.id,
    getHash: (item) => [item.type, item.timestamp, item.title, item.summary, item.route].join('|'),
  })
  const missionPageFreshness = {
    // [LAW:one-source-of-truth] A page-level signal is derived from section freshness signals instead of tracking another source.
    lastUpdatedAt: Math.max(hotSessionFreshness.lastUpdatedAt ?? 0, activityFreshness.lastUpdatedAt ?? 0) || null,
    newCount: hotSessionFreshness.newCount + activityFreshness.newCount,
    updatedCount: hotSessionFreshness.updatedCount + activityFreshness.updatedCount,
    removedCount: hotSessionFreshness.removedCount + activityFreshness.removedCount,
    getItemClassName: () => '',
  }

  return (
    <Stack>
      <MotionSection variant="swing">
        <Group justify="space-between">
        <div>
          <Title order={2}>Mission Control</Title>
          <Text c="dimmed">Live command center for sessions, activity, and health ({preset}).</Text>
          <FreshnessBadges freshness={missionPageFreshness} label="Page freshness" />
        </div>
        <Group>
          <Button variant="default" onClick={() => navigate({ to: '/search' })}>Search</Button>
          <Button onClick={() => navigate({ to: '/sessions' })}>Jump to Sessions</Button>
        </Group>
        </Group>
      </MotionSection>

      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <MotionCard flavor="orbit" index={0}>
            <Card withBorder>
              <Text c="dimmed" size="sm">Active Sessions</Text>
              <Title order={3}>{isLoading ? '--' : (data?.kpis.active_sessions ?? 0).toLocaleString()}</Title>
            </Card>
          </MotionCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <MotionCard flavor="flip" index={1}>
            <Card withBorder>
              <Text c="dimmed" size="sm">Window Tokens</Text>
              <Title order={3}>{isLoading ? '--' : (data?.kpis.total_tokens_window ?? 0).toLocaleString()}</Title>
            </Card>
          </MotionCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <MotionCard flavor="pulse" index={2}>
            <Card withBorder>
              <Text c="dimmed" size="sm">Health</Text>
              <Group mt="xs">
                <Badge color={data?.health.db_connected ? 'green' : 'red'} variant="light">
                  {data?.health.db_connected ? 'DB Connected' : 'DB Disconnected'}
                </Badge>
                <Badge variant="outline">Lag: {(data?.health.indexer_lag_seconds ?? 0)}s</Badge>
              </Group>
            </Card>
          </MotionCard>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card withBorder>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600}>Hot Sessions</Text>
                <FreshnessBadges freshness={hotSessionFreshness} label="Table" />
              </Group>
              <ScrollArea h={360}>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Session</Table.Th>
                      <Table.Th>Project</Table.Th>
                      <Table.Th>Messages</Table.Th>
                      <Table.Th>Todos</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(data?.hot_sessions || []).map((session) => (
                      <Table.Tr
                        key={session.id}
                        className={hotSessionFreshness.getItemClassName(session.id)}
                        onClick={() => navigate({ to: '/sessions/$sessionId', params: { sessionId: session.id } })}
                        style={{ cursor: 'pointer' }}
                      >
                        <Table.Td>{session.id.slice(0, 8)}</Table.Td>
                        <Table.Td>{session.project_path || 'N/A'}</Table.Td>
                        <Table.Td>{session.message_count}</Table.Td>
                        <Table.Td>{session.todo_count}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card withBorder>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text fw={600}>Activity Feed</Text>
                <FreshnessBadges freshness={activityFreshness} label="Feed" />
              </Group>
              <ScrollArea h={360}>
                <Stack gap="xs">
                  {activityLoading ? (
                    <Text size="sm" c="dimmed">Loading activity...</Text>
                  ) : (activityData?.events || []).length === 0 ? (
                    <Text size="sm" c="dimmed">No activity events.</Text>
                  ) : (
                    (activityData?.events || []).map((event, index) => (
                      <MotionListItem
                        key={event.id}
                        index={index}
                        flavor={index % 3 === 0 ? 'orbit' : index % 3 === 1 ? 'flip' : 'pulse'}
                      >
                        <Card withBorder padding="sm" className={activityFreshness.getItemClassName(event.id)}>
                        <Group justify="space-between">
                          <Badge variant="outline">{event.type}</Badge>
                          <Text size="xs" c="dimmed">{new Date(event.timestamp).toLocaleString()}</Text>
                        </Group>
                        <Text fw={500}>{event.title}</Text>
                        <Text size="sm" c="dimmed" lineClamp={2}>{event.summary}</Text>
                        <Button
                          size="xs"
                          variant="subtle"
                          mt="xs"
                          onClick={() => navigate({ to: event.route as never })}
                        >
                          Open
                        </Button>
                        </Card>
                      </MotionListItem>
                    ))
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
