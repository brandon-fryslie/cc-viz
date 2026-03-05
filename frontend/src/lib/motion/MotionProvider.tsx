import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const MOTION_STORAGE_KEY = 'cc-viz-motion-enabled'

interface MotionContextValue {
  motionEnabled: boolean
  shouldAnimate: boolean
  setMotionEnabled: (enabled: boolean) => void
}

const MotionContext = createContext<MotionContextValue | null>(null)

function readInitialMotionValue(): boolean {
  if (typeof window === 'undefined') return true
  const value = window.localStorage.getItem(MOTION_STORAGE_KEY)
  if (value === null || value === undefined) return true
  return value === 'true'
}

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [motionEnabled, setMotionEnabledState] = useState<boolean>(readInitialMotionValue)

  const setMotionEnabled = useCallback((enabled: boolean) => {
    setMotionEnabledState(enabled)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(MOTION_STORAGE_KEY, String(motionEnabled))
  }, [motionEnabled])

  const value = useMemo(() => ({
    motionEnabled,
    shouldAnimate: motionEnabled,
    setMotionEnabled,
  }), [motionEnabled, setMotionEnabled])

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>
}

export function useMotionPreference(): MotionContextValue {
  const value = useContext(MotionContext)
  if (!value) {
    throw new Error('useMotionPreference must be used inside MotionProvider')
  }
  return value
}
