import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { LiveProvider } from '@/lib/live/LiveProvider'
import { V3DateRangeProvider } from '@/lib/v3-date-range'
import { AppShellRoot } from '@/mantine/layout/AppShellRoot'
import { OverviewPage } from '@/pages-v3/OverviewPage'
import { MissionControlPage } from '@/pages-v3/MissionControlPage'
import { SessionsExplorerPage } from '@/pages-v3/SessionsExplorerPage'
import { ConversationDetailPage } from '@/pages-v3/ConversationDetailPage'
import { PlanDetailPage } from '@/pages-v3/PlanDetailPage'
import { TokenEconomicsPage } from '@/pages-v3/TokenEconomicsPage'
import { ExtensionsConfigPage } from '@/pages-v3/ExtensionsConfigPage'
import { SearchPage } from '@/pages-v3/SearchPage'

const rootRoute = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <LiveProvider>
      <V3DateRangeProvider>
        <AppShellRoot />
      </V3DateRangeProvider>
    </LiveProvider>
  )
}

const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: OverviewPage,
})

const missionControlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mission-control',
  component: MissionControlPage,
})

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: () => <SessionsExplorerPage />,
})

const sessionDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions/$sessionId',
  component: SessionDetailRouteComponent,
})

function SessionDetailRouteComponent() {
  const params = sessionDetailRoute.useParams()
  return <SessionsExplorerPage sessionId={params.sessionId} />
}

const conversationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/conversations/$conversationId',
  component: ConversationDetailRouteComponent,
})

function ConversationDetailRouteComponent() {
  const params = conversationDetailRoute.useParams()
  return <ConversationDetailPage conversationId={params.conversationId} />
}

const planDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/plans/$planId',
  component: PlanDetailRouteComponent,
})

function PlanDetailRouteComponent() {
  const params = planDetailRoute.useParams()
  return <PlanDetailPage planId={params.planId} />
}

const tokenEconomicsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/token-economics',
  component: TokenEconomicsPage,
})

const extensionsConfigRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/extensions-config',
  component: () => <ExtensionsConfigPage />,
})

const extensionConfigDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/extensions-config/$type/$id',
  component: ExtensionConfigDetailRouteComponent,
})

function ExtensionConfigDetailRouteComponent() {
  const params = extensionConfigDetailRoute.useParams()
  return <ExtensionsConfigPage type={params.type} id={params.id} />
}

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchPage,
})

const routeTree = rootRoute.addChildren([
  overviewRoute,
  missionControlRoute,
  sessionsRoute,
  sessionDetailRoute,
  conversationDetailRoute,
  planDetailRoute,
  tokenEconomicsRoute,
  extensionsConfigRoute,
  extensionConfigDetailRoute,
  searchRoute,
])

export const router = createRouter({ routeTree })
