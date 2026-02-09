/**
 * V2 Home Page - Mantine Dashboard Shell
 *
 * This is the landing page for the v2 dashboard.
 * Demonstrates Mantine components are working correctly.
 */

import {
  Title,
  Text,
  Card,
  SimpleGrid,
  Badge,
  Group,
  Stack,
  ThemeIcon,
  Button,
} from '@mantine/core';
import {
  IconChartBar,
  IconBinaryTree2,
  IconPuzzle,
  IconRocket,
} from '@tabler/icons-react';

const features = [
  {
    title: 'Token Economics',
    description: 'Track token usage, costs, and analytics across your Claude sessions.',
    icon: IconChartBar,
    color: 'blue',
    href: '/v2/token-economics',
    status: 'planned',
  },
  {
    title: 'Mission Control',
    description: 'Visualize subagent hierarchies and task delegation patterns.',
    icon: IconBinaryTree2,
    color: 'violet',
    href: '/v2/mission-control',
    status: 'planned',
  },
  {
    title: 'Extension Workshop',
    description: 'Browse and manage extensions, skills, commands, and hooks.',
    icon: IconPuzzle,
    color: 'teal',
    href: '/v2/extension-workshop',
    status: 'planned',
  },
];

export function V2HomePage() {
  return (
    <Stack gap="xl">
      {/* Hero Section */}
      <Stack gap="xs">
        <Group>
          <ThemeIcon size="xl" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
            <IconRocket size={28} />
          </ThemeIcon>
          <div>
            <Title order={1}>V2 Dashboard</Title>
            <Text c="dimmed" size="lg">
              A fresh start with Mantine UI
            </Text>
          </div>
        </Group>
      </Stack>

      {/* Status Card */}
      <Card withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={500}>Migration Status</Text>
            <Badge color="yellow" variant="light">In Progress</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            This is the v2 dashboard, built from scratch with Mantine.
            Components and pages will be added incrementally.
          </Text>
          <Group gap="xs">
            <Badge variant="dot" color="green">Mantine Installed</Badge>
            <Badge variant="dot" color="green">Theme Configured</Badge>
            <Badge variant="dot" color="green">AppShell Working</Badge>
          </Group>
        </Stack>
      </Card>

      {/* Feature Cards */}
      <Stack gap="sm">
        <Title order={3}>Planned Pages</Title>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {features.map((feature) => (
            <Card key={feature.title} withBorder padding="lg">
              <Stack gap="md">
                <Group justify="space-between">
                  <ThemeIcon size="lg" radius="md" color={feature.color} variant="light">
                    <feature.icon size={20} />
                  </ThemeIcon>
                  <Badge size="sm" variant="outline" color="gray">
                    {feature.status}
                  </Badge>
                </Group>
                <div>
                  <Text fw={500} size="lg">{feature.title}</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    {feature.description}
                  </Text>
                </div>
                <Button
                  variant="light"
                  color={feature.color}
                  fullWidth
                  disabled
                >
                  Coming Soon
                </Button>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>

      {/* Tech Stack */}
      <Card withBorder>
        <Stack gap="sm">
          <Text fw={500}>Tech Stack</Text>
          <Group gap="xs">
            <Badge>Mantine v8</Badge>
            <Badge>React 19</Badge>
            <Badge>TanStack Router</Badge>
            <Badge>TanStack Query</Badge>
            <Badge>Recharts</Badge>
            <Badge>TypeScript</Badge>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}
