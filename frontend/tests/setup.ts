/**
 * Vitest Setup File
 *
 * Global test setup and configuration for Token Economics unit tests.
 */

import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'

// Clean up after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock window.matchMedia (not available in jsdom)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock,
})

// Silence console.error in tests (optional - helps focus on test failures)
const originalError = console.error
beforeAll(() => {
  // Uncomment to silence console errors during tests
  // console.error = vi.fn()
})

// Set up test timeout
vi.setConfig({
  testTimeout: 10000,
})
