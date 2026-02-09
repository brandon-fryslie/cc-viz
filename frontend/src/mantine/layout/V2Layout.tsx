/**
 * V2 Layout - Mantine AppShell for v2 pages
 *
 * This is the root layout for all /v2/* routes.
 * Uses Mantine AppShell for navigation structure.
 */

import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from '@tanstack/react-router';
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  Title,
} from '@mantine/core';
import {
  IconHome,
  IconChartBar,
  IconBinaryTree2,
  IconPuzzle,
  IconArrowLeft,
} from '@tabler/icons-react';

// Navigation items for v2 dashboard
const navItems = [
  {
    label: 'V2 Home',
    icon: IconHome,
    href: '/v2',
  },
  {
    label: 'Token Economics',
    icon: IconChartBar,
    href: '/v2/token-economics',
  },
  {
    label: 'Mission Control',
    icon: IconBinaryTree2,
    href: '/v2/mission-control',
  },
  {
    label: 'Extension Workshop',
    icon: IconPuzzle,
    href: '/v2/extension-workshop',
  },
];

export function V2Layout() {
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/v2') {
      return location.pathname === '/v2';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <AppShell
      header={{ height: 50 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={() => setOpened(!opened)}
              hiddenFrom="sm"
              size="sm"
            />
            <Title order={4} c="white">CC-Viz v2</Title>
          </Group>
          <NavLink
            component="a"
            href="/"
            label="Back to v1"
            leftSection={<IconArrowLeft size={16} />}
            variant="subtle"
            active={false}
            style={{ width: 'auto' }}
          />
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <AppShell.Section>
          <Text size="xs" fw={500} c="dimmed" tt="uppercase" mb="xs">
            V2 Dashboard
          </Text>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea}>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              label={item.label}
              leftSection={<item.icon size={20} stroke={1.5} />}
              active={isActive(item.href)}
              onClick={() => navigate({ to: item.href })}
              variant="filled"
              mb={4}
            />
          ))}
        </AppShell.Section>

        <AppShell.Section>
          <Text size="xs" c="dimmed">
            Mantine v8 · Experimental
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
