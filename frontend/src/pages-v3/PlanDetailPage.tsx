import { Card, Code, Stack, Text, Title } from '@mantine/core'
import { useV3Plan } from '@/lib/api-v3'
import { MotionCard, MotionSection } from '@/lib/motion/primitives'

export function PlanDetailPage({ planId }: { planId: string }) {
  const { data, isLoading, error } = useV3Plan(planId)

  if (isLoading) return <Text c="dimmed">Loading plan...</Text>
  if (error || !data) return <Text c="red">Failed to load plan.</Text>

  return (
    <Stack>
      <MotionSection>
        <div>
          <Title order={2}>Plan</Title>
          <Text c="dimmed">{data.display_name}</Text>
        </div>
      </MotionSection>

      <MotionCard>
        <Card withBorder>
          <Text size="sm" c="dimmed">{data.file_name}</Text>
          <Text mt="xs">{data.preview}</Text>
        </Card>
      </MotionCard>

      <MotionCard>
        <Card withBorder>
          <Code block>{data.content}</Code>
        </Card>
      </MotionCard>
    </Stack>
  )
}
