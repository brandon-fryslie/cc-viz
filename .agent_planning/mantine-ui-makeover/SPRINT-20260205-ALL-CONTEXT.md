# Implementation Context: Mantine UI Makeover

## Overview

Complete frontend migration from Tailwind CSS + CVA to Mantine UI v7. Goal: sleek, modern, polished dashboard.

## Current Architecture

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # 15 base components (Button, Card, Badge, etc.)
│   │   ├── features/        # 17 feature components
│   │   ├── charts/          # 12 chart wrappers (keep Recharts)
│   │   ├── layout/          # 4 layout components
│   │   └── UnifiedSearchModal.tsx
│   ├── pages/               # 22 pages
│   ├── lib/                 # Utils, API, types
│   ├── routes/              # TanStack Router routes
│   ├── contexts/            # DateRange, Theme contexts
│   ├── index.css            # Design tokens
│   ├── main.tsx             # Entry point
│   └── theme.ts             # (NEW) Mantine theme
```

## Key Mappings

### Component Replacements

| Current | Mantine |
|---------|---------|
| Button (CVA) | Button |
| Card | Card, Paper |
| Badge | Badge |
| Input | TextInput |
| Tabs | Tabs |
| DetailDrawer | Drawer |
| Modal (custom) | Modal |
| Sidebar | AppShell.Navbar + NavLink |
| AppLayout | AppShell |

### Design Token Mapping

| Current CSS Variable | Mantine Theme |
|---------------------|---------------|
| --color-bg-primary (#1a1a1a) | theme.colors.dark[9] |
| --color-bg-secondary (#222222) | theme.colors.dark[8] |
| --color-bg-tertiary (#2a2a2a) | theme.colors.dark[7] |
| --color-accent (#3b82f6) | theme.primaryColor = 'blue' |
| --color-success (#10b981) | theme.colors.green |
| --color-warning (#f59e0b) | theme.colors.yellow |
| --color-error (#ef4444) | theme.colors.red |
| --color-info (#06b6d4) | theme.colors.cyan |

### Spacing Mapping

| Current | Mantine |
|---------|---------|
| --space-3 (8px) | xs |
| --space-4 (12px) | sm |
| --space-5 (16px) | md |
| --space-6 (24px) | lg |
| --space-7 (32px) | xl |

## Packages to Install

```bash
pnpm add @mantine/core @mantine/hooks @mantine/dates dayjs postcss postcss-preset-mantine
```

## Theme Configuration (theme.ts)

```typescript
import { createTheme, MantineColorsTuple } from '@mantine/core';

const blue: MantineColorsTuple = [
  '#e7f5ff', '#d0ebff', '#a5d8ff', '#74c0fc',
  '#4dabf7', '#339af0', '#228be6', '#1c7ed6',
  '#1971c2', '#1864ab'
];

export const theme = createTheme({
  colorScheme: 'dark',
  primaryColor: 'blue',
  colors: { blue },
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  fontFamilyMonospace: 'ui-monospace, SF Mono, Menlo, monospace',
  defaultRadius: 'md',
  spacing: {
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
});
```

## Migration Pattern

For each component:

1. Import Mantine component
2. Replace JSX with Mantine equivalent
3. Map props (variant, size, etc.)
4. Replace Tailwind classes with Mantine props
5. Test visually

Example - Button migration:

```typescript
// BEFORE (CVA + Tailwind)
import { cva } from 'class-variance-authority';
const buttonVariants = cva('inline-flex...', { variants: {...} });
export const Button = ({ variant, size, ...props }) => (
  <button className={cn(buttonVariants({ variant, size }))} {...props} />
);

// AFTER (Mantine)
import { Button as MantineButton } from '@mantine/core';
const variantMap = { primary: 'filled', secondary: 'outline', ghost: 'subtle', danger: 'filled' };
export const Button = ({ variant = 'primary', ...props }) => (
  <MantineButton variant={variantMap[variant]} color={variant === 'danger' ? 'red' : undefined} {...props} />
);
```

## Files Requiring Modification

### Sprint 1: Foundation (4 files)
- package.json
- postcss.config.cjs (new)
- src/theme.ts (new)
- src/main.tsx

### Sprint 2: Core Components (10 files)
- src/components/ui/Button.tsx
- src/components/ui/Card.tsx
- src/components/ui/Badge.tsx
- src/components/ui/Input.tsx
- src/components/ui/SearchInput.tsx
- src/components/ui/Tabs.tsx
- src/components/ui/DetailDrawer.tsx
- src/components/ui/StatusBadge.tsx
- src/components/features/ConfirmDeleteModal.tsx
- src/components/features/RequestCompareModal.tsx

### Sprint 3: Layout Shell (5 files)
- src/components/layout/Sidebar.tsx
- src/components/layout/AppLayout.tsx
- src/components/layout/GlobalDatePicker.tsx
- src/components/layout/ResizablePanel.tsx
- src/routes/__root.tsx

### Sprint 4: Feature Components (~35 files)
- All files in src/components/features/
- All files in src/components/charts/
- Remaining files in src/components/ui/
- All files in src/components/ui/tools/

### Sprint 5: Pages & Polish (~28 files)
- All 22 pages in src/pages/
- src/components/UnifiedSearchModal.tsx
- package.json (remove Tailwind)
- postcss.config.cjs (cleanup)
- src/index.css (simplify)
- src/lib/utils.ts (update cn())

## Verification

After each sprint:
1. `pnpm dev` starts without errors
2. All pages render correctly
3. No console errors
4. Interactive states work (hover, focus, click)
5. Dark mode consistent

Final verification:
1. `pnpm build` succeeds
2. `pnpm test:unit` passes
3. Visual review of all pages
4. Performance acceptable (bundle size)
