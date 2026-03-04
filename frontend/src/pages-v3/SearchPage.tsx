import { useMemo, useState } from 'react'
import { Badge, Button, Card, Group, ScrollArea, Stack, Text, TextInput, Title } from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { useV3Search } from '@/lib/api-v3'
import { routeFromSearchResult } from '@/lib/deep-links'

export function SearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const { data, isLoading } = useV3Search(query, { limit: 30 })

  const groups = useMemo(() => {
    if (!data?.sections) return [] as Array<[string, { total: number; results: Array<Record<string, unknown>> }]>
    return Object.entries(data.sections).filter(([, section]) => section.total > 0)
  }, [data])

  return (
    <Stack>
      <div>
        <Title order={2}>Search</Title>
        <Text c="dimmed">Search everything and deep-link directly to resource artifacts.</Text>
      </div>

      <TextInput
        placeholder="Search sessions, conversations, messages, todos, plans, files, extensions, plugins, config"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      {query.trim().length < 2 ? (
        <Text size="sm" c="dimmed">Type at least 2 characters.</Text>
      ) : isLoading ? (
        <Text size="sm" c="dimmed">Searching...</Text>
      ) : groups.length === 0 ? (
        <Text size="sm" c="dimmed">No results.</Text>
      ) : (
        <ScrollArea h={680}>
          <Stack>
            {groups.map(([name, section]) => (
              <Card key={name} withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={600} tt="capitalize">{name}</Text>
                    <Badge variant="outline">{section.total}</Badge>
                  </Group>

                  {section.results.map((result, index) => {
                    const route = routeFromSearchResult(result)
                    return (
                      <Button
                        key={`${name}-${index}`}
                        variant="subtle"
                        justify="flex-start"
                        onClick={() => route && navigate({ to: route as never })}
                      >
                        <Group gap="xs" wrap="nowrap" align="flex-start">
                          <Badge size="xs">{name}</Badge>
                          <div>
                            <Text size="sm">{String(result.name || result.title || result.id || 'Result')}</Text>
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {String(result.preview || result.snippet || result.project_name || result.file_path || '')}
                            </Text>
                          </div>
                        </Group>
                      </Button>
                    )
                  })}
                </Stack>
              </Card>
            ))}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  )
}
