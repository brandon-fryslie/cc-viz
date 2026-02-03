import { createRouter, createRootRoute, createRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Sidebar, GlobalDatePicker } from '@/components/layout'
import { UnifiedSearchModal } from '@/components/UnifiedSearchModal'
import { DateRangeProvider } from '@/lib/DateRangeContext'
import { ThemeProvider } from '@/lib/ThemeContext'

// Home page
import { HomePage } from '@/pages/Home'

// Request pages
import { RequestsPage } from '@/pages/Requests'

// Conversation pages
import { ConversationsPage } from '@/pages/Conversations'

// Extensions pages
import { ExtensionsHubPage } from '@/pages/ExtensionsHub'
import { PluginViewPage } from '@/pages/PluginView'

// Plugins page (Marketplaces & Plugins)

// Session data pages
import SessionDataPage from '@/pages/SessionData'
import { TodosSearchPage } from '@/pages/TodosSearch'
import { PlansSearchPage } from '@/pages/PlansSearch'

// New showcase views
import { CockpitView } from '@/pages/CockpitView'
import { TokenEconomicsPage } from '@/pages/TokenEconomics'
import { MissionControlPage } from '@/pages/MissionControl'
import { SessionTimeline } from '@/pages/SessionTimeline'
import { ExtensionWorkshop } from '@/pages/ExtensionWorkshop'

// Settings
import { SettingsPage } from '@/pages/Settings'

// Claude Config
import { ClaudeConfigPage } from '@/pages/ClaudeConfig'

// Root route with layout
const rootRoute = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const navigate = useNavigate()
  const [activeItem, setActiveItem] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Sync active item with current route
  useEffect(() => {
    const path = window.location.pathname
    const item = path.slice(1) || ''
    setActiveItem(item.split('/')[0]) // Get first segment for nested routes
  }, [])

  // Handle global search keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault()
        setIsSearchOpen(!isSearchOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  const handleItemSelect = (id: string) => {
    setActiveItem(id)
    navigate({ to: `/${id}` })
  }

  return (
    <ThemeProvider>
      <DateRangeProvider>
        <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
          <Sidebar activeItem={activeItem} onItemSelect={handleItemSelect} />
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Global date picker header */}
            <div className="flex items-center justify-end h-10 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
              <GlobalDatePicker />
            </div>
            <Outlet />
          </main>
          {/* Unified Search Modal */}
          <UnifiedSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </div>
      </DateRangeProvider>
    </ThemeProvider>
  )
}

// Define routes

// Home page route
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

// Cockpit route
const cockpitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cockpit',
  component: CockpitView,
})

// Request routes
const requestsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests',
  component: RequestsPage,
})

const requestDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/requests/$id',
  component: RequestsPage, // RequestsPage handles detail view
})

// Conversation routes
const conversationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversations',
  component: ConversationsPage,
})

const conversationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversations/$id',
  component: ConversationsPage, // ConversationsPage handles detail view
})

// Extensions routes
const extensionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/extensions',
  component: ExtensionsHubPage,
})

const pluginDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/extensions/$id',
  component: PluginViewPage,
})

// Plugins route (Marketplaces & Plugins view)
const pluginsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plugins',
  component: PluginViewPage,
})

// Session data route
const sessionDataRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session-data',
  component: SessionDataPage,
})

// Todos search route
const todosSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/todos-search',
  component: TodosSearchPage,
})

// Plans search route
const plansSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans-search',
  component: PlansSearchPage,
})

// Token Economics route
const tokenEconomicsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/token-economics',
  component: TokenEconomicsPage,
})

// Mission Control route
const missionControlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mission-control',
  component: MissionControlPage,
})

// Session Timeline route
const sessionTimelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session-timeline',
  component: SessionTimeline,
})

// Extension Workshop route
const extensionWorkshopRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/extension-workshop',
  component: ExtensionWorkshop,
})

// Settings route
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
})

// Claude Config route
const claudeConfigRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/claude-config',
  component: ClaudeConfigPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([
  homeRoute,
  missionControlRoute,
  sessionTimelineRoute,
  cockpitRoute,
  tokenEconomicsRoute,
  extensionWorkshopRoute,
  requestsRoute,
  requestDetailRoute,
  conversationsRoute,
  conversationDetailRoute,
  extensionsRoute,
  pluginDetailRoute,
  pluginsRoute,
  sessionDataRoute,
  todosSearchRoute,
  plansSearchRoute,
  settingsRoute,
  claudeConfigRoute,
])

// Create router
export const router = createRouter({ routeTree })

// Type declaration for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
