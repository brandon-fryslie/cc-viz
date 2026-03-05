import { Button, Card, Grid, Group, Stack, Text, Title } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { FreshnessBadges } from '@/components/live/FreshnessBadges'
import { useV3Overview } from '@/lib/api-v3'
import { useListFreshness } from '@/lib/live/useListFreshness'
import { MotionBurst, MotionCard, MotionPop, MotionSection, MotionText } from '@/lib/motion/primitives'
import { useV3DateRange } from '@/lib/v3-date-range'

export function OverviewPage() {
  const navigate = useNavigate()
  const { start, end, preset } = useV3DateRange()
  const { data, isLoading } = useV3Overview({ start, end })
  const overviewFreshness = useListFreshness(data ? [data] : [], {
    scopeKey: `overview-${start}-${end}`,
    getId: () => 'overview',
    getHash: (item) => [
      item.kpis.active_sessions,
      item.kpis.total_sessions,
      item.kpis.total_messages,
      item.kpis.total_tokens_window,
      item.kpis.avg_tokens_per_session,
    ].join('|'),
  })

  const kpis = data?.kpis

  return (
    <Stack>
      <MotionSection variant="spiral">
        <Group justify="space-between">
        <div>
          <Title order={2}><MotionText text="Overview" delay={0.1} /></Title>
          <Text c="dimmed">Compact operational summary with direct actions ({preset}).</Text>
          <FreshnessBadges freshness={overviewFreshness} label="Overview freshness" />
        </div>
        <Group>
          <MotionPop delay={0.3} index={0}><Button variant="light" onClick={() => navigate({ to: '/mission-control' })}>Mission Control</Button></MotionPop>
          <MotionPop delay={0.3} index={1}><Button onClick={() => navigate({ to: '/sessions' })}>Open Sessions</Button></MotionPop>
        </Group>
        </Group>
      </MotionSection>

      <Grid>
        {[
          { label: 'Active Sessions', value: kpis?.active_sessions ?? 0 },
          { label: 'Total Sessions', value: kpis?.total_sessions ?? 0 },
          { label: 'Total Messages', value: kpis?.total_messages ?? 0 },
          { label: 'Window Tokens', value: kpis?.total_tokens_window ?? 0 },
          { label: 'Avg Tokens/Session', value: kpis?.avg_tokens_per_session ?? 0 },
        ].map((item, index) => (
          <Grid.Col key={item.label} span={{ base: 12, sm: 6, lg: 4 }}>
            <MotionBurst delay={index * 0.07}>
            <MotionCard
              index={index}
              flavor={(['vortex', 'slam', 'elastic', 'ricochet', 'pulse'] as const)[index % 5]}
            >
              <Card withBorder className={overviewFreshness.getItemClassName('overview')}>
                <Text size="sm" c="dimmed">{item.label}</Text>
                <Title order={3}>{isLoading ? '--' : item.value.toLocaleString()}</Title>
              </Card>
            </MotionCard>
            </MotionBurst>
          </Grid.Col>
        ))}
      </Grid>

      <MotionSection delay={0.1} variant="swing">
        <Card withBorder>
        <Stack gap="sm">
          <Text fw={600}>Quick Links</Text>
          <Group>
            <Button variant="default" onClick={() => navigate({ to: '/search' })}>Search</Button>
            <Button variant="default" onClick={() => navigate({ to: '/token-economics' })}>Token Economics</Button>
            <Button variant="default" onClick={() => navigate({ to: '/extensions-config' })}>Extensions & Config</Button>
          </Group>
        </Stack>
        </Card>
      </MotionSection>
    </Stack>
  )
}
