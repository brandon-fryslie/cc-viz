import { Card, Code, Group, ScrollArea, Stack, Text, Title } from '@mantine/core'
import { useV3Conversation } from '@/lib/api-v3'

export function ConversationDetailPage({ conversationId }: { conversationId: string }) {
  const { data, isLoading, error } = useV3Conversation(conversationId)

  if (isLoading) return <Text c="dimmed">Loading conversation...</Text>
  if (error || !data) return <Text c="red">Failed to load conversation.</Text>

  return (
    <Stack>
      <Group justify="space-between">
        <div>
          <Title order={2}>Conversation</Title>
          <Text c="dimmed">{data.conversation.sessionId}</Text>
        </div>
        <Text size="sm" c="dimmed">{data.conversation.projectName}</Text>
      </Group>

      <Card withBorder>
        <Text size="sm" c="dimmed">{data.file_path}</Text>
      </Card>

      <Card withBorder>
        <ScrollArea h={620}>
          <Stack>
            {data.conversation.messages.map((message) => (
              <Card key={message.uuid} withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={600}>{message.type}</Text>
                  <Text size="xs" c="dimmed">{new Date(message.timestamp).toLocaleString()}</Text>
                </Group>
                <Code block>{JSON.stringify(message, null, 2)}</Code>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      </Card>
    </Stack>
  )
}
