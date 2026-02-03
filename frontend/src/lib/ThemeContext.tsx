import { createContext, useContext, type ReactNode } from 'react'

/**
 * Theme type - only 'dark' mode per user request
 */
export type Theme = 'dark'

interface ThemeContextValue {
  /**
   * Current theme (always 'dark')
   */
  theme: Theme
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

interface ThemeProviderProps {
  children: ReactNode
}

/**
 * ThemeProvider - simplified dark mode only provider per user request.
 * User requested: "Don't bother with Light Mode. Just make dark mode very balanced and good looking"
 *
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  // Always use dark theme
  const theme: Theme = 'dark'

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * useTheme hook to access the current theme.
 * Always returns 'dark' per user request.
 *
 * @example
 * ```tsx
 * const { theme } = useTheme()
 * console.log(theme) // 'dark'
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
