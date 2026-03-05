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

function formatTokens(value: number | undefined): string {
  const numeric = value ?? 0
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(1)}M`
  if (numeric >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`
  return String(numeric)
}

function formatPercent(value: number | undefined): string {
  return `${(value ?? 0).toFixed(1)}%`
}

export function ConversationDetailPage({ conversationId }: { conversationId: string }) {
  const { data, isLoading, error } = useV3Conversation(conversationId)

  if (isLoading) return <Text c="dimmed">Loading conversation...</Text>
  if (error || !data) return <Text c="red">Failed to load conversation.</Text>

  return (
    <Stack>
      <MotionSection variant="swing">
        <Group justify="space-between">
        <div>
          <Title order={2}>Conversation</Title>
          <Text c="dimmed">{data.conversation.sessionId}</Text>
        </div>
        <Text size="sm" c="dimmed">{data.conversation.projectName}</Text>
        </Group>
      </MotionSection>

      <MotionCard flavor="orbit" index={0}>
        <Card withBorder>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">{data.file_path}</Text>
            <Group gap="xs">
              <Badge variant="light">Total {formatTokens(data.token_summary.totalTokens)}</Badge>
              <Badge variant="outline">Input {formatTokens(data.token_summary.inputTokens)}</Badge>
              <Badge variant="outline">Output {formatTokens(data.token_summary.outputTokens)}</Badge>
              <Badge variant="outline">Read {formatTokens(data.token_summary.cacheReadTokens)}</Badge>
              <Badge variant="outline">Write {formatTokens(data.token_summary.cacheCreationTokens)}</Badge>
              <Badge variant="light">Hit {formatPercent(data.token_summary.cacheHitRatePercent)}</Badge>
            </Group>
          </Stack>
        </Card>
      </MotionCard>

      <MotionCard flavor="flip" index={1}>
        <Card withBorder>
        <ScrollArea h={620}>
          <Stack>
            {data.conversation.messages.map((message, index) => {
              const summary = summarizeMessage(message)
              return (
                <MotionListItem
                  key={message.uuid}
                  index={index}
                  flavor={index % 3 === 0 ? 'orbit' : index % 3 === 1 ? 'flip' : 'pulse'}
                >
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
