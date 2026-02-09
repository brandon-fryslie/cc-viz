import { createTheme } from '@mantine/core';
import type { MantineColorsTuple } from '@mantine/core';

// Custom blue to match existing --color-accent (#3b82f6)
const blue: MantineColorsTuple = [
  '#e7f5ff',
  '#d0ebff',
  '#a5d8ff',
  '#74c0fc',
  '#4dabf7',
  '#339af0',
  '#228be6',
  '#1c7ed6',
  '#1971c2',
  '#1864ab',
];

export const theme = createTheme({
  // Dark mode by default
  primaryColor: 'blue',
  colors: {
    blue,
  },

  // Typography matching existing design tokens
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", monospace',

  // Font sizes matching existing --text-* tokens
  fontSizes: {
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '18px',
  },

  // Spacing matching existing --space-* tokens
  spacing: {
    xs: '8px',   // --space-3
    sm: '12px',  // --space-4
    md: '16px',  // --space-5
    lg: '24px',  // --space-6
    xl: '32px',  // --space-7
  },

  // Border radius matching existing --radius-* tokens
  radius: {
    xs: '4px',   // --radius-sm
    sm: '6px',
    md: '8px',   // --radius-md
    lg: '12px',  // --radius-lg
    xl: '16px',  // --radius-xl
  },

  // Default radius for components
  defaultRadius: 'md',

  // Heading styles
  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '32px', lineHeight: '1.25' },
      h2: { fontSize: '24px', lineHeight: '1.25' },
      h3: { fontSize: '18px', lineHeight: '1.3' },
      h4: { fontSize: '16px', lineHeight: '1.4' },
      h5: { fontSize: '14px', lineHeight: '1.5' },
      h6: { fontSize: '13px', lineHeight: '1.5' },
    },
  },

  // Component-specific overrides
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'sm',
      },
    },
    Select: {
      defaultProps: {
        size: 'sm',
      },
    },
    Card: {
      defaultProps: {
        padding: 'md',
        radius: 'md',
        withBorder: true,
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});
