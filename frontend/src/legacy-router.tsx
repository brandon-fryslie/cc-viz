import { createRouter, createRootRoute, createRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { useState, useEffect } from 'react'
import { Sidebar, GlobalDatePicker, SearchBar } from '@/components/layout'
import { DateRangeProvider } from '@/lib/DateRangeContext'
import { ThemeProvider } from '@/lib/ThemeContext'
import { SearchProvider } from '@/lib/SearchContext'

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

// V2 Pages (Mantine)
import { V2Layout } from '@/mantine/layout'
import { V2HomePage } from '@/pages-v2/V2Home'

// Root route with layout
const rootRoute = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const navigate = useNavigate()
  const [activeItem, setActiveItem] = useState('')

  // Sync active item with current route
  useEffect(() => {
    const rawPath = window.location.pathname
    // [LAW:one-source-of-truth] Legacy router resolves active nav from basepath-trimmed URL.
    const path = rawPath.startsWith('/legacy') ? rawPath.slice('/legacy'.length) || '/' : rawPath
    const item = path.slice(1) || ''
    setActiveItem(item.split('/')[0]) // Get first segment for nested routes
  }, [])

  const handleItemSelect = (id: string) => {
    setActiveItem(id)
    navigate({ to: `/${id}` })
  }

  return (
    <NuqsAdapter>
      <ThemeProvider>
        <DateRangeProvider>
          <SearchProvider>
            <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
              <Sidebar activeItem={activeItem} onItemSelect={handleItemSelect} />
              <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Global search bar + date picker header */}
                <div className="flex items-center justify-between gap-4 h-10 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                  <SearchBar />
                  <GlobalDatePicker />
                </div>
                <Outlet />
              </main>
            </div>
          </SearchProvider>
        </DateRangeProvider>
      </ThemeProvider>
    </NuqsAdapter>
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

// ============================================
// V2 Routes (Mantine Dashboard)
// ============================================

// V2 parent route with Mantine layout
const v2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/v2',
  component: V2Layout,
})

// V2 Home page
const v2HomeRoute = createRoute({
  getParentRoute: () => v2Route,
  path: '/',
  component: V2HomePage,
})

// V2 Token Economics (placeholder for now)
const v2TokenEconomicsRoute = createRoute({
  getParentRoute: () => v2Route,
  path: '/token-economics',
  component: () => (
    <div style={{ padding: '20px' }}>
      <h1>Token Economics v2</h1>
      <p>Coming soon...</p>
    </div>
  ),
})

// V2 Mission Control (placeholder for now)
const v2MissionControlRoute = createRoute({
  getParentRoute: () => v2Route,
  path: '/mission-control',
  component: () => (
    <div style={{ padding: '20px' }}>
      <h1>Mission Control v2</h1>
      <p>Coming soon...</p>
    </div>
  ),
})

// V2 Extension Workshop (placeholder for now)
const v2ExtensionWorkshopRoute = createRoute({
  getParentRoute: () => v2Route,
  path: '/extension-workshop',
  component: () => (
    <div style={{ padding: '20px' }}>
      <h1>Extension Workshop v2</h1>
      <p>Coming soon...</p>
    </div>
  ),
})

// Create v2 route tree
const v2RouteTree = v2Route.addChildren([
  v2HomeRoute,
  v2TokenEconomicsRoute,
  v2MissionControlRoute,
  v2ExtensionWorkshopRoute,
])

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
  // V2 Dashboard routes
  v2RouteTree,
])

// Create router
export const legacyRouter = createRouter({ routeTree, basepath: '/legacy' })
