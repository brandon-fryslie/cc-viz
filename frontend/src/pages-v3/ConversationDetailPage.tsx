import { Badge, Card, Code, Group, ScrollArea, Stack, Text, Title } from '@mantine/core'
import { useV3Conversation } from '@/lib/api-v3'
import { MotionCard, MotionListItem, MotionSection } from '@/lib/motion/primitives'

function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) {
    return 'Timestamp unavailable'
  }
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) {
    return 'Timestamp unavailable'
  }
  return parsed.toLocaleString()
}

function summarizeMessage(message: {
  type: string
  message?: {
    role?: string
    content?: unknown
  }
}) {
  const role = message.message?.role || 'event'
  if (typeof message.message?.content === 'string') {
    return { role, preview: message.message.content }
  }
  return { role, preview: '' }
}

export function ConversationDetailPage({ conversationId }: { conversationId: string }) {
  const { data, isLoading, error } = useV3Conversation(conversationId)

  if (isLoading) return <Text c="dimmed">Loading conversation...</Text>
  if (error || !data) return <Text c="red">Failed to load conversation.</Text>

  return (
    <Stack>
      <MotionSection>
        <Group justify="space-between">
        <div>
          <Title order={2}>Conversation</Title>
          <Text c="dimmed">{data.conversation.sessionId}</Text>
        </div>
        <Text size="sm" c="dimmed">{data.conversation.projectName}</Text>
        </Group>
      </MotionSection>

      <MotionCard>
        <Card withBorder>
          <Text size="sm" c="dimmed">{data.file_path}</Text>
        </Card>
      </MotionCard>

      <MotionCard>
        <Card withBorder>
        <ScrollArea h={620}>
          <Stack>
            {data.conversation.messages.map((message) => {
              const summary = summarizeMessage(message)
              return (
                <MotionListItem key={message.uuid}>
                  <Card withBorder>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Badge variant="outline">{message.type}</Badge>
                      <Badge variant="light">{summary.role}</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{formatTimestamp(message.timestamp)}</Text>
                  </Group>
                  {summary.preview && (
                    <Text size="sm" mb="xs" lineClamp={3}>{summary.preview}</Text>
                  )}
                  <Code block>{JSON.stringify(message, null, 2)}</Code>
                  </Card>
                </MotionListItem>
              )
            })}
          </Stack>
        </ScrollArea>
        </Card>
      </MotionCard>
    </Stack>
  )
}
