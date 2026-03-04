import { createContext, useContext, useMemo, useState } from 'react'

export type V3DatePreset = '24h' | '7d' | '30d'

interface V3DateRangeValue {
  preset: V3DatePreset
  setPreset: (preset: V3DatePreset) => void
  start: string
  end: string
}

const V3DateRangeContext = createContext<V3DateRangeValue | null>(null)

function computeRange(preset: V3DatePreset): { start: string; end: string } {
  const end = new Date()
  const start = new Date(end)

  if (preset === '24h') {
    start.setHours(start.getHours() - 24)
  } else if (preset === '30d') {
    start.setDate(start.getDate() - 30)
  } else {
    start.setDate(start.getDate() - 7)
  }

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

export function V3DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPreset] = useState<V3DatePreset>('7d')
  const range = useMemo(() => computeRange(preset), [preset])

  const value = useMemo<V3DateRangeValue>(() => ({
    preset,
    setPreset,
    start: range.start,
    end: range.end,
  }), [preset, range.end, range.start])

  return <V3DateRangeContext.Provider value={value}>{children}</V3DateRangeContext.Provider>
}

export function useV3DateRange() {
  const value = useContext(V3DateRangeContext)
  if (!value) {
    throw new Error('useV3DateRange must be used within V3DateRangeProvider')
  }
  return value
}
