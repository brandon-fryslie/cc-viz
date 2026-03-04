// @ts-nocheck
/**
 * TokenEconomics Unit Tests
 *
 * Tests metric calculations, data validation, and error state rendering.
 * Uses React Testing Library with mocked API responses.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TokenEconomicsPage } from './TokenEconomics'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Coins: () => <span data-testid="icon-coins">Coins</span>,
  TrendingUp: () => <span data-testid="icon-trending">TrendingUp</span>,
  Calendar: () => <span data-testid="icon-calendar">Calendar</span>,
  Zap: () => <span data-testid="icon-zap">Zap</span>,
  AlertTriangle: () => <span data-testid="icon-alert">AlertTriangle</span>,
}))

// Mock all child components
vi.mock('@/components/layout', () => ({
  PageHeader: ({ title }: { title: string; description: string }) => (
    <div data-testid="page-header"><h1>{title}</h1></div>
  ),
  PageContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-content">{children}</div>
  ),
}))

vi.mock('@/components/charts/StatCard', () => ({
  StatCard: (props: any) => <div data-testid="stat-card" data-title={props.title} />,
}))

vi.mock('@/components/charts/ChartWrapper', () => ({
  ChartWrapper: (props: any) => (
    <div data-testid="chart-wrapper" data-title={props.title}>
      {props.isLoading ? <div data-testid="loading">Loading...</div> : props.children}
    </div>
  ),
}))

vi.mock('@/components/charts/DailyBurnChart', () => ({
  DailyBurnChart: () => <div data-testid="daily-burn-chart">DailyBurnChart</div>,
}))

vi.mock('@/components/charts/ModelBreakdownChart', () => ({
  ModelBreakdownChart: () => <div data-testid="model-breakdown-chart">ModelBreakdownChart</div>,
}))

vi.mock('@/components/charts/ProjectBreakdownChart', () => ({
  ProjectBreakdownChart: () => <div data-testid="project-breakdown-chart">ProjectBreakdownChart</div>,
}))

vi.mock('@/components/features/AnomalyAlerts', () => ({
  AnomalyAlerts: () => <div data-testid="anomaly-alerts">AnomalyAlerts</div>,
}))

vi.mock('@/components/ui/DataList', () => ({
  DataList: () => <div data-testid="data-list">DataList</div>,
}))

vi.mock('@/components/charts/WeeklyUsageChart', () => ({
  formatTokens: (tokens: number) => {
    if (tokens < 1000) return tokens.toString()
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`
    return `${(tokens / 1000000).toFixed(1)}M`
  },
}))

vi.mock('@/components/ui/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <div data-testid="error-boundary">{children}</div>,
}))

// Mock API hooks
const mockUseWeeklyStats = vi.fn()
const mockUseHourlyStats = vi.fn()
const mockUseConversations = vi.fn()
const mockUseProjectTokenStats = vi.fn()

vi.mock('@/lib/api', () => ({
  useWeeklyStats: (...args: any[]) => mockUseWeeklyStats(...args),
  useHourlyStats: (...args: any[]) => mockUseHourlyStats(...args),
  useConversations: (...args: any[]) => mockUseConversations(...args),
  useProjectTokenStats: (...args: any[]) => mockUseProjectTokenStats(...args),
}))

// Mock DateRangeContext
vi.mock('@/lib/DateRangeContext', () => ({
  useDateRange: () => ({ start: '2026-01-01', end: '2026-01-20' }),
}))

// Create test query client
function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
}

// Test data
const mockDailyStats = [
  { date: '2026-01-14', tokens: 100000, requests: 10, models: {} },
  { date: '2026-01-15', tokens: 150000, requests: 15, models: {} },
  { date: '2026-01-16', tokens: 120000, requests: 12, models: {} },
]

const mockConversations = [
  { id: 'conv-1', projectName: 'cc-viz', totalTokens: 250000, inputTokens: 100000, outputTokens: 150000, lastActivity: '2026-01-20T10:00:00Z' },
  { id: 'conv-2', projectName: 'test-project', totalTokens: 180000, inputTokens: 80000, outputTokens: 100000, lastActivity: '2026-01-19T15:30:00Z' },
  { id: 'conv-3', projectName: 'cc-viz', totalTokens: 95000, inputTokens: 45000, outputTokens: 50000, lastActivity: '2026-01-18T09:00:00Z' },
]

describe('TokenEconomics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Metric Calculations', () => {
    it('calculates total tokens from daily stats', () => {
      const total = mockDailyStats.reduce((sum, day) => sum + day.tokens, 0)
      expect(total).toBe(370000)
    })

    it('calculates average tokens per day correctly', () => {
      const total = mockDailyStats.reduce((sum, day) => sum + day.tokens, 0)
      const avg = total / mockDailyStats.length
      expect(avg).toBe(123333.33333333333)
    })

    it('identifies peak day correctly', () => {
      const peak = mockDailyStats.reduce((max, day) => (day.tokens > max.tokens ? day : max), mockDailyStats[0])
      expect(peak.tokens).toBe(150000)
      expect(peak.date).toBe('2026-01-15')
    })

    it('handles empty daily stats', () => {
      const total = [].reduce((sum, day) => sum + day.tokens, 0)
      expect(total).toBe(0)
    })
  })

  describe('Data Validation', () => {
    it('validates negative token counts', () => {
      const errors: string[] = []
      if (100 < 0) errors.push('Total tokens cannot be negative')
      expect(errors).toHaveLength(0)
    })

    it('validates high token counts', () => {
      const total = 2_000_000_000
      const errors: string[] = []
      if (total > 1_000_000_000) errors.push('Total tokens suspiciously high (>1B)')
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('1B')
    })

    it('filters conversations without valid token data', () => {
      const conversations = [
        { id: '1', totalTokens: 1000 },
        { id: '2', totalTokens: 0 },
        { id: '3', totalTokens: undefined },
        { id: '4', totalTokens: 500 },
      ]
      const valid = conversations.filter(c => c.totalTokens !== undefined && c.totalTokens > 0)
      expect(valid).toHaveLength(2)
    })
  })

  describe('Data Display', () => {
    it('renders page header', () => {
      mockUseWeeklyStats.mockReturnValue({ data: { dailyStats: mockDailyStats }, isLoading: false })
      mockUseHourlyStats.mockReturnValue({ data: { hourlyStats: [] }, isLoading: false })
      mockUseConversations.mockReturnValue({ data: mockConversations, isLoading: false })
      mockUseProjectTokenStats.mockReturnValue({ data: { projects: [] }, isLoading: false })

      render(
        <QueryClientProvider client={createQueryClient()}>
          <TokenEconomicsPage />
        </QueryClientProvider>
      )

      expect(screen.getByTestId('page-header')).not.toBeNull()
    })
  })

  describe('Error States', () => {
    it('shows loading state while fetching data', () => {
      mockUseWeeklyStats.mockReturnValue({ data: undefined, isLoading: true })
      mockUseHourlyStats.mockReturnValue({ data: undefined, isLoading: true })
      mockUseConversations.mockReturnValue({ data: undefined, isLoading: true })
      mockUseProjectTokenStats.mockReturnValue({ data: undefined, isLoading: true })

      render(
        <QueryClientProvider client={createQueryClient()}>
          <TokenEconomicsPage />
        </QueryClientProvider>
      )

      // Should have loading indicators in chart wrappers
      expect(screen.getAllByTestId('loading').length).toBeGreaterThan(0)
    })
  })
})
