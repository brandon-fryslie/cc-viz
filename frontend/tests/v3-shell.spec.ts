import { expect, test } from '@playwright/test'

function json(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v3/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname

    if (path.endsWith('/api/v3/overview')) {
      await route.fulfill(json({
        generated_at: new Date().toISOString(),
        kpis: {
          active_sessions: 1,
          total_sessions: 1,
          total_messages: 1,
          conversations_window: 1,
          total_tokens_window: 1,
          avg_tokens_per_session: 1,
        },
      }))
      return
    }

    if (path.endsWith('/api/v3/mission-control')) {
      await route.fulfill(json({
        generated_at: new Date().toISOString(),
        kpis: {
          active_sessions: 1,
          total_sessions: 1,
          total_messages: 1,
          conversations_window: 1,
          total_tokens_window: 1,
          avg_tokens_per_session: 1,
        },
        hot_sessions: [],
        health: { db_connected: true, indexer_lag_seconds: 0 },
      }))
      return
    }

    if (path.endsWith('/api/v3/mission-control/activity')) {
      await route.fulfill(json({ events: [], limit: 50 }))
      return
    }

    if (path.endsWith('/api/v3/sessions')) {
      await route.fulfill(json({ sessions: [], total: 0 }))
      return
    }

    if (path.match(/\/api\/v3\/sessions\/[^/]+$/)) {
      await route.fulfill(json({
        session: {
          id: 'session-1',
          conversation_count: 0,
          message_count: 0,
          agent_count: 0,
          todo_count: 0,
          created_at: new Date().toISOString(),
        },
        conversations: [],
        files: [],
        plans: [],
        todos: [],
      }))
      return
    }

    if (path.match(/\/api\/v3\/sessions\/[^/]+\/messages$/)) {
      await route.fulfill(json({ session_id: 'session-1', messages: [], total: 0 }))
      return
    }

    if (path.match(/\/api\/v3\/conversations\/[^/]+$/)) {
      await route.fulfill(json({
        conversation: {
          sessionId: 'session-1',
          projectPath: '/tmp/project',
          projectName: 'project',
          messages: [],
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          messageCount: 0,
        },
        file_path: '/tmp/project/example.jsonl',
        project_path: '/tmp/project',
      }))
      return
    }

    if (path.match(/\/api\/v3\/plans\/[^/]+$/)) {
      await route.fulfill(json({
        id: 1,
        file_name: 'plan.md',
        display_name: 'Plan',
        content: '',
        preview: '',
        modified_at: new Date().toISOString(),
      }))
      return
    }

    if (path.endsWith('/api/v3/token-economics/summary')) {
      await route.fulfill(json({
        generated_at: new Date().toISOString(),
        total_tokens: 0,
        burn_rate_per_day: 0,
        peak_day_tokens: 0,
        trend_percent: 0,
      }))
      return
    }

    if (path.endsWith('/api/v3/token-economics/timeseries')) {
      await route.fulfill(json({ bucket: 'day', points: [] }))
      return
    }

    if (path.endsWith('/api/v3/token-economics/projects')) {
      await route.fulfill(json({ projects: [] }))
      return
    }

    if (path.endsWith('/api/v3/extensions-config')) {
      await route.fulfill(json({ extensions: [], plugins: [], marketplaces: [], config: {}, total: 0 }))
      return
    }

    if (path.match(/\/api\/v3\/extensions-config\/[^/]+\/[^/]+$/)) {
      await route.fulfill(json({ extension: null, related: [], config: {} }))
      return
    }

    if (path.endsWith('/api/v3/search')) {
      await route.fulfill(json({ query: url.searchParams.get('q') || '', sections: {} }))
      return
    }

    await route.fulfill(json({}))
  })
})

test('v3 navigation and motion switch work', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

  await page.goto('/mission-control')
  await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()

  await page.goto('/sessions')
  await expect(page.getByRole('heading', { name: 'Sessions Explorer' })).toBeVisible()

  await page.goto('/token-economics')
  await expect(page.getByRole('heading', { name: 'Token Economics' })).toBeVisible()

  await page.goto('/extensions-config')
  await expect(page.getByRole('heading', { name: 'Extensions & Config' })).toBeVisible()

  await page.goto('/search')
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible()

  const shell = page.locator('[data-motion]')
  await expect(shell).toHaveAttribute('data-motion', 'on')
  await page.getByRole('switch', { name: 'Motion' }).click()
  await expect(shell).toHaveAttribute('data-motion', 'off')
})
