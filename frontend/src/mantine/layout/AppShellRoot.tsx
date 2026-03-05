import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import {
  AppShell,
  Badge,
  Burger,
  Button,
  Card,
  Divider,
  Group,
  Kbd,
  Modal,
  NavLink,
  ScrollArea,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useDisclosure, useHotkeys } from '@mantine/hooks'
import { motion } from 'framer-motion'
import {
  IconActivity,
  IconBolt,
  IconHome,
  IconPlugConnected,
  IconSearch,
  IconTimeline,
} from '@tabler/icons-react'
import { useV3Search } from '@/lib/api-v3'
import { routeFromSearchResult } from '@/lib/deep-links'
import { useLive } from '@/lib/live/LiveProvider'
import { useMotionPreference } from '@/lib/motion/MotionProvider'
import { MotionListItem, MotionPage, MotionText } from '@/lib/motion/primitives'
import { useV3DateRange } from '@/lib/v3-date-range'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; stroke?: number }>
}

const navItems: NavItem[] = [
  { label: 'Overview', href: '/', icon: IconHome },
  { label: 'Mission Control', href: '/mission-control', icon: IconActivity },
  { label: 'Sessions', href: '/sessions', icon: IconTimeline },
  { label: 'Token Economics', href: '/token-economics', icon: IconBolt },
  { label: 'Extensions & Config', href: '/extensions-config', icon: IconPlugConnected },
  { label: 'Search', href: '/search', icon: IconSearch },
]

export function AppShellRoot() {
  const [opened, { toggle }] = useDisclosure(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { connected, lastHeartbeat } = useLive()
  const { motionEnabled, setMotionEnabled, shouldAnimate } = useMotionPreference()
  const { preset, setPreset } = useV3DateRange()

  const [paletteOpen, { open: openPalette, close: closePalette }] = useDisclosure(false)
  const [query, setQuery] = useState('')

  useHotkeys([
    ['mod+K', () => openPalette()],
    ['/', () => openPalette()],
  ])

  const { data: searchData, isLoading: searchLoading } = useV3Search(query, {
    enabled: paletteOpen,
    limit: 12,
  })

  const resultGroups = useMemo(() => {
    if (!searchData?.sections) return []
    return Object.entries(searchData.sections)
      .filter(([, section]) => section.total > 0)
      .sort(([a], [b]) => a.localeCompare(b))
  }, [searchData])

  return (
    <>
      <AppShell
        header={{ height: 56 }}
        navbar={{
          width: 280,
          breakpoint: 'sm',
          collapsed: { mobile: !opened },
        }}
        padding="md"
        data-motion={motionEnabled ? 'on' : 'off'}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <motion.div
                animate={shouldAnimate ? {
                  y:      [0, -10, 4, -7, 2, 0],
                  scale:  [1, 1.18, 0.92, 1.14, 0.97, 1],
                  rotate: [0, -5, 3, -4, 2, 0],
                  skewX:  [0, 4, -3, 2, 0],
                } : undefined}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                whileHover={shouldAnimate ? { scale: 1.4, rotate: 15, y: -8, filter: 'hue-rotate(45deg)' } : undefined}
                whileTap={shouldAnimate ? { scale: 0.7, rotate: -30 } : undefined}
                style={{ cursor: shouldAnimate ? 'pointer' : 'default' }}
              >
                {shouldAnimate
                  ? <MotionText text="CC-Viz" delay={0} />
                  : <Title order={4}>CC-Viz</Title>}
              </motion.div>
            </Group>
            <Group>
              <SegmentedControl
                size="xs"
                value={preset}
                onChange={(value) => setPreset(value as '24h' | '7d' | '30d')}
                data={[
                  { label: '24h', value: '24h' },
                  { label: '7d', value: '7d' },
                  { label: '30d', value: '30d' },
                ]}
              />
              <Button variant="light" leftSection={<IconSearch size={14} />} onClick={openPalette}>
                Search
              </Button>
              <Switch
                label="Motion"
                size="sm"
                checked={motionEnabled}
                onChange={(event) => setMotionEnabled(event.currentTarget.checked)}
              />
              <Badge variant="light" color={motionEnabled ? 'violet' : 'gray'}>
                {motionEnabled ? 'MAX' : 'OFF'}
              </Badge>
              <Group gap={6}>
                <motion.div
                  animate={shouldAnimate ? {
                    scale:  [1, 1.2, 0.9, 1.15, 0.95, 1],
                    y:      [0, -5, 2, -4, 1, 0],
                    rotate: [0, -3, 3, -2, 0],
                  } : undefined}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  whileHover={shouldAnimate ? { scale: 1.35, rotate: 10 } : undefined}
                >
                  <Badge color={connected ? 'green' : 'red'} variant="dot">
                    {connected ? 'Live' : 'Offline'}
                  </Badge>
                </motion.div>
                <Text size="xs" c="dimmed">
                  {lastHeartbeat ? new Date(lastHeartbeat).toLocaleTimeString() : 'No heartbeat'}
                </Text>
              </Group>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm">
          <AppShell.Section>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" px="sm" pb="sm">
              Navigation
            </Text>
          </AppShell.Section>
          <AppShell.Section grow component={ScrollArea}>
            <Stack gap={4}>
              {navItems.map((item) => (
                <MotionListItem key={item.href} flavor={item.href.length % 2 === 0 ? 'orbit' : 'flip'}>
                  <NavLink
                    label={item.label}
                    leftSection={<item.icon size={18} stroke={1.7} />}
                    active={location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href))}
                    onClick={() => navigate({ to: item.href })}
                  />
                </MotionListItem>
              ))}
            </Stack>
          </AppShell.Section>
          <AppShell.Section pt="sm">
            <Text size="xs" c="dimmed" ta="center">
              Mantine-first rebuild
            </Text>
          </AppShell.Section>
        </AppShell.Navbar>

        <AppShell.Main>
          <MotionPage routeKey={location.pathname}>
            <Outlet />
          </MotionPage>
        </AppShell.Main>
      </AppShell>

      <Modal opened={paletteOpen} onClose={closePalette} title="Search Everything" centered size="lg">
        <Stack>
          <TextInput
            id="global-command-palette-query"
            name="global-command-palette-query"
            autoFocus
            leftSection={<IconSearch size={14} />}
            placeholder="Search sessions, conversations, todos, plans, files, extensions, plugins, config..."
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            rightSection={<Kbd>⌘K</Kbd>}
          />
          <Divider />
          {query.trim().length < 2 ? (
            <Text size="sm" c="dimmed">
              Type at least 2 characters.
            </Text>
          ) : searchLoading ? (
            <Text size="sm" c="dimmed">Searching...</Text>
          ) : resultGroups.length === 0 ? (
            <Text size="sm" c="dimmed">No results.</Text>
          ) : (
            <ScrollArea h={420}>
              <Stack gap="sm">
                {resultGroups.map(([group, section]) => (
                  <MotionListItem key={group} flavor="pulse">
                    <Card withBorder>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text fw={600} tt="capitalize">{group}</Text>
                        <Badge variant="light">{section.total}</Badge>
                      </Group>
                      {section.results.slice(0, 6).map((result, index) => {
                        const route = routeFromSearchResult(result)
                        const title = String(result.name || result.title || result.id || 'Result')
                        const subtitle = String(result.preview || result.snippet || result.project_name || result.file_path || '')
                        return (
                          <Button
                            key={`${group}-${index}`}
                            variant="subtle"
                            justify="flex-start"
                            onClick={() => {
                              if (!route) return
                              navigate({ to: route })
                              closePalette()
                            }}
                          >
                            <Group gap={8} wrap="nowrap">
                              <Badge size="xs" variant="outline">{group}</Badge>
                              <Stack gap={0}>
                                <Text size="sm">{title}</Text>
                                {subtitle && <Text size="xs" c="dimmed" lineClamp={1}>{subtitle}</Text>}
                              </Stack>
                            </Group>
                          </Button>
                        )
                      })}
                    </Stack>
                    </Card>
                  </MotionListItem>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Modal>
    </>
  )
}
