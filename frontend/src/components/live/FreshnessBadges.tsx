import { Badge, Group, Text } from '@mantine/core'
import type { ListFreshness } from '@/lib/live/useListFreshness'

interface FreshnessBadgesProps {
  freshness: ListFreshness
  label?: string
}

function formatUpdatedLabel(lastUpdatedAt: number | null): string {
  if (!lastUpdatedAt) return 'Waiting for updates'
  return `Updated ${new Date(lastUpdatedAt).toLocaleTimeString()}`
}

export function FreshnessBadges({ freshness, label = 'Live data' }: FreshnessBadgesProps) {
  return (
    <Group gap="xs">
      <Text size="xs" c="dimmed">{label}</Text>
      <Badge size="sm" variant="light" color={freshness.lastUpdatedAt ? 'teal' : 'gray'}>
        {formatUpdatedLabel(freshness.lastUpdatedAt)}
      </Badge>
      {freshness.newCount > 0 && (
        <Badge size="sm" variant="light" color="green">
          {freshness.newCount} new
        </Badge>
      )}
      {freshness.updatedCount > 0 && (
        <Badge size="sm" variant="light" color="blue">
          {freshness.updatedCount} updated
        </Badge>
      )}
      {freshness.removedCount > 0 && (
        <Badge size="sm" variant="light" color="gray">
          {freshness.removedCount} removed
        </Badge>
      )}
    </Group>
  )
}
