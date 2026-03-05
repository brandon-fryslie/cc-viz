import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { MotionProvider, useMotionPreference } from './MotionProvider'

function MotionProbe() {
  const { motionEnabled, setMotionEnabled } = useMotionPreference()
  return (
    <>
      <span data-testid="motion-state">{motionEnabled ? 'on' : 'off'}</span>
      <button type="button" onClick={() => setMotionEnabled(!motionEnabled)}>toggle</button>
    </>
  )
}

describe('MotionProvider', () => {
  it('defaults to enabled and persists toggle', async () => {
    const user = userEvent.setup()
    render(
      <MotionProvider>
        <MotionProbe />
      </MotionProvider>,
    )

    expect(screen.getByTestId('motion-state').textContent).toBe('on')
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.getByTestId('motion-state').textContent).toBe('off')
  })
})
