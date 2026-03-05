import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useListFreshness } from './useListFreshness'

interface Item {
  id: string
  value: string
}

function Probe({ items }: { items?: Item[] }) {
  const freshness = useListFreshness(items, {
    scopeKey: 'test-scope',
    getId: (item) => item.id,
    getHash: (item) => item.value,
  })

  return (
    <>
      <span data-testid="new-count">{freshness.newCount}</span>
      <span data-testid="updated-count">{freshness.updatedCount}</span>
    </>
  )
}

describe('useListFreshness', () => {
  it('does not mark initial resolved data as new', async () => {
    const { rerender } = render(<Probe />)
    expect(screen.getByTestId('new-count').textContent).toBe('0')

    rerender(<Probe items={[{ id: 'a', value: 'one' }]} />)
    expect(screen.getByTestId('new-count').textContent).toBe('0')
    expect(screen.getByTestId('updated-count').textContent).toBe('0')

    rerender(<Probe items={[{ id: 'a', value: 'one' }, { id: 'b', value: 'two' }]} />)
    expect(screen.getByTestId('new-count').textContent).toBe('1')
    expect(screen.getByTestId('updated-count').textContent).toBe('0')
  })
})
