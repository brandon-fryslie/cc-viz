import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Card,
  Code,
  Grid,
  Group,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { FreshnessBadges } from '@/components/live/FreshnessBadges'
import { parseFocusFromSearch } from '@/lib/deep-links'
import { useV3Session, useV3SessionMessages, useV3Sessions } from '@/lib/api-v3'
import { useLiveTopic } from '@/lib/live/LiveProvider'
import { useListFreshness } from '@/lib/live/useListFreshness'
import { MotionCard, MotionListItem, MotionSection } from '@/lib/motion/primitives'

interface SessionsExplorerPageProps {
  sessionId?: string
}

interface ArtifactSelection {
  kind: string
  value: string
  payload: unknown
}

export function SessionsExplorerPage({ sessionId }: SessionsExplorerPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<string>('messages')
  const [selection, setSelection] = useState<ArtifactSelection | null>(null)

  const { data: sessionList, isLoading: sessionsLoading } = useV3Sessions({ limit: 150, q: query })
  const selectedSessionId = sessionId || sessionList?.sessions?.[0]?.id || null

  useLiveTopic(selectedSessionId ? `session:${selectedSessionId}` : null)

  const { data: sessionDetail, isLoading: detailLoading } = useV3Session(selectedSessionId)
  const { data: sessionMessages, isLoading: messagesLoading } = useV3SessionMessages(selectedSessionId, { limit: 300 })
  const sessionsFreshness = useListFreshness(sessionList?.sessions, {
    scopeKey: `sessions-list-${query}`,
    getId: (item) => item.id,
    getHash: (item) => [item.message_count, item.todo_count, item.conversation_count, item.agent_count, item.project_path || ''].join('|'),
  })
  const messagesFreshness = useListFreshness(sessionMessages?.messages, {
    scopeKey: `session-messages-${selectedSessionId || 'none'}`,
    getId: (item) => item.uuid,
    getHash: (item) => [item.timestamp, item.type, item.role || '', item.model || ''].join('|'),
  })
  const todosFreshness = useListFreshness(sessionDetail?.todos, {
    scopeKey: `session-todos-${selectedSessionId || 'none'}`,
    getId: (item) => String(item.id),
    getHash: (item) => [item.status, item.modified_at, item.content].join('|'),
  })
  const plansFreshness = useListFreshness(sessionDetail?.plans, {
    scopeKey: `session-plans-${selectedSessionId || 'none'}`,
    getId: (item) => String(item.id),
    getHash: (item) => [item.modified_at, item.preview].join('|'),
  })
  const filesFreshness = useListFreshness(sessionDetail?.files, {
    scopeKey: `session-files-${selectedSessionId || 'none'}`,
    getId: (item) => String(item.id),
    getHash: (item) => [item.file_path, item.change_type, item.timestamp || ''].join('|'),
  })
  const conversationsFreshness = useListFreshness(sessionDetail?.conversations, {
    scopeKey: `session-conversations-${selectedSessionId || 'none'}`,
    getId: (item) => item.id,
    getHash: (item) => [item.lastActivity, item.messageCount, item.projectName].join('|'),
  })

  const activeTabFreshness = useMemo(() => {
    if (tab === 'messages') return messagesFreshness
    if (tab === 'todos') return todosFreshness
    if (tab === 'plans') return plansFreshness
    if (tab === 'files') return filesFreshness
    return conversationsFreshness
  }, [conversationsFreshness, filesFreshness, messagesFreshness, plansFreshness, tab, todosFreshness])

  const pageFreshness = {
    // [LAW:one-source-of-truth] Page freshness is derived from list + active tab freshness metadata.
    lastUpdatedAt: Math.max(sessionsFreshness.lastUpdatedAt ?? 0, activeTabFreshness.lastUpdatedAt ?? 0) || null,
    newCount: sessionsFreshness.newCount + activeTabFreshness.newCount,
    updatedCount: sessionsFreshness.updatedCount + activeTabFreshness.updatedCount,
    removedCount: sessionsFreshness.removedCount + activeTabFreshness.removedCount,
    getItemClassName: () => '',
  }

  const searchString = typeof (location as { searchStr?: string }).searchStr === 'string'
    ? (location as { searchStr?: string }).searchStr!
    : window.location.search
  const focus = useMemo(() => parseFocusFromSearch(searchString), [searchString])

  useEffect(() => {
    if (!focus) return
    setTab(focus.tab)
  }, [focus])

  useEffect(() => {
    if (!focus || !sessionDetail) return
    const value = focus.value

    if (focus.kind === 'todo') {
      const match = sessionDetail.todos.find((item) => String(item.id) === value)
      if (match) {
        setSelection({ kind: 'todo', value, payload: match })
      }
    }

    if (focus.kind === 'file') {
      const match = sessionDetail.files.find((item) => item.file_path === value)
      if (match) {
        setSelection({ kind: 'file', value, payload: match })
      }
    }

    if (focus.kind === 'message') {
      const match = sessionMessages?.messages.find((item) => item.uuid === value)
      if (match) {
        setSelection({ kind: 'message', value, payload: match })
      }
    }
  }, [focus, sessionDetail, sessionMessages])

  const onSelectSession = (id: string) => {
    navigate({ to: '/sessions/$sessionId', params: { sessionId: id } })
  }

  const renderTable = (
    rows: Array<Record<string, unknown>>,
    columns: Array<{ key: string; label: string }>,
    kind: string,
    getItemClassName?: (id: string) => string,
  ) => {
    if (rows.length === 0) {
      return <Text size="sm" c="dimmed">No data for this tab.</Text>
    }

    return (
      <ScrollArea h={420}>
        <Table withTableBorder striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th key={column.key}>{column.label}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, index) => {
              const idValue = String(row.id || row.uuid || index)
              return (
                <Table.Tr
                  key={idValue}
                  className={getItemClassName ? getItemClassName(idValue) : undefined}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelection({ kind, value: idValue, payload: row })}
                >
                  {columns.map((column) => (
                    <Table.Td key={`${idValue}-${column.key}`}>
                      {String(row[column.key] ?? '')}
                    </Table.Td>
                  ))}
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    )
  }

  return (
    <Stack>
      <MotionSection variant="swing">
        <Group justify="space-between">
        <div>
          <Title order={2}>Sessions Explorer</Title>
          <Text c="dimmed">Canonical session-centric view for messages, todos, plans, files, and related conversations.</Text>
          <FreshnessBadges freshness={pageFreshness} label="Page freshness" />
        </div>
        {selectedSessionId && <Badge variant="light">Session {selectedSessionId.slice(0, 8)}</Badge>}
        </Group>
      </MotionSection>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 3 }}>
          <MotionCard flavor="orbit" index={0}>
            <Card withBorder>
            <Stack>
              <FreshnessBadges freshness={sessionsFreshness} label="Session list" />
              <TextInput
                id="sessions-filter-query"
                name="sessions-filter-query"
                placeholder="Filter sessions by ID/path"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
              <ScrollArea h={560}>
                <Stack gap="xs">
                  {sessionsLoading ? (
                    <Text size="sm" c="dimmed">Loading sessions...</Text>
                  ) : (sessionList?.sessions || []).map((session, index) => (
                    <MotionListItem
                      key={session.id}
                      index={index}
                      flavor={index % 3 === 0 ? 'flip' : index % 3 === 1 ? 'orbit' : 'pulse'}
                    >
                      <Card
                        className={sessionsFreshness.getItemClassName(session.id)}
                        withBorder
                        padding="sm"
                        style={{ cursor: 'pointer', borderColor: selectedSessionId === session.id ? 'var(--mantine-color-blue-5)' : undefined }}
                        onClick={() => onSelectSession(session.id)}
                      >
                        <Text fw={600}>{session.id.slice(0, 10)}</Text>
                        <Text size="xs" c="dimmed" lineClamp={2}>{session.project_path || 'No project path'}</Text>
                        <Group mt="xs" gap={6}>
                          <Badge size="xs" variant="outline">msg {session.message_count}</Badge>
                          <Badge size="xs" variant="outline">todo {session.todo_count}</Badge>
                        </Group>
                      </Card>
                    </MotionListItem>
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
            </Card>
          </MotionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <MotionCard flavor="flip" index={1}>
            <Card withBorder>
            {detailLoading ? (
              <Text size="sm" c="dimmed">Loading session detail...</Text>
            ) : !sessionDetail ? (
              <Text size="sm" c="dimmed">Select a session.</Text>
            ) : (
              <Tabs value={tab} onChange={(value) => setTab(value || 'messages')}>
                <FreshnessBadges freshness={activeTabFreshness} label="Active tab" />
                <Tabs.List>
                  <Tabs.Tab value="messages">Messages ({sessionMessages?.messages.length || 0})</Tabs.Tab>
                  <Tabs.Tab value="todos">Todos ({sessionDetail.todos.length})</Tabs.Tab>
                  <Tabs.Tab value="plans">Plans ({sessionDetail.plans.length})</Tabs.Tab>
                  <Tabs.Tab value="files">Files ({sessionDetail.files.length})</Tabs.Tab>
                  <Tabs.Tab value="conversations">Conversations ({sessionDetail.conversations.length})</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="messages" pt="sm">
                  {messagesLoading
                    ? <Text size="sm" c="dimmed">Loading messages...</Text>
                    : renderTable(
                      (sessionMessages?.messages || []) as unknown as Array<Record<string, unknown>>,
                      [
                        { key: 'uuid', label: 'UUID' },
                        { key: 'role', label: 'Role' },
                        { key: 'model', label: 'Model' },
                        { key: 'timestamp', label: 'Timestamp' },
                      ],
                      'message',
                      messagesFreshness.getItemClassName,
                    )}
                </Tabs.Panel>

                <Tabs.Panel value="todos" pt="sm">
                  {renderTable(
                    sessionDetail.todos as unknown as Array<Record<string, unknown>>,
                    [
                      { key: 'id', label: 'ID' },
                      { key: 'status', label: 'Status' },
                      { key: 'content', label: 'Content' },
                      { key: 'modified_at', label: 'Modified' },
                    ],
                    'todo',
                    todosFreshness.getItemClassName,
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="plans" pt="sm">
                  {renderTable(
                    sessionDetail.plans as unknown as Array<Record<string, unknown>>,
                    [
                      { key: 'id', label: 'ID' },
                      { key: 'display_name', label: 'Name' },
                      { key: 'preview', label: 'Preview' },
                      { key: 'modified_at', label: 'Modified' },
                    ],
                    'plan',
                    plansFreshness.getItemClassName,
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="files" pt="sm">
                  {renderTable(
                    sessionDetail.files as unknown as Array<Record<string, unknown>>,
                    [
                      { key: 'id', label: 'ID' },
                      { key: 'file_path', label: 'Path' },
                      { key: 'change_type', label: 'Change' },
                      { key: 'timestamp', label: 'Timestamp' },
                    ],
                    'file',
                    filesFreshness.getItemClassName,
                  )}
                </Tabs.Panel>

                <Tabs.Panel value="conversations" pt="sm">
                  {renderTable(
                    sessionDetail.conversations.map((item) => ({
                      id: item.id,
                      projectName: item.projectName,
                      messageCount: item.messageCount,
                      lastActivity: item.lastActivity,
                    })) as unknown as Array<Record<string, unknown>>,
                    [
                      { key: 'id', label: 'Conversation' },
                      { key: 'projectName', label: 'Project' },
                      { key: 'messageCount', label: 'Messages' },
                      { key: 'lastActivity', label: 'Last Activity' },
                    ],
                    'conversation',
                    conversationsFreshness.getItemClassName,
                  )}
                </Tabs.Panel>
              </Tabs>
            )}
            </Card>
          </MotionCard>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3 }}>
          <MotionCard flavor="pulse" index={2}>
            <Card withBorder>
            <Stack>
              <Text fw={600}>Artifact Detail</Text>
              {!selection ? (
                <Text size="sm" c="dimmed">Select any row to inspect artifact data.</Text>
              ) : (
                <>
                  <Badge variant="light">{selection.kind}</Badge>
                  <Code block>{JSON.stringify(selection.payload, null, 2)}</Code>
                </>
              )}
            </Stack>
            </Card>
          </MotionCard>
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
