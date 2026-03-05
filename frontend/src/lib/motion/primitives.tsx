import { AnimatePresence, motion } from 'framer-motion'
import type { PropsWithChildren } from 'react'
import { useMotionPreference } from './MotionProvider'

export const MOTION_TRANSITION = {
  type: 'spring',
  stiffness: 240,
  damping: 14,
  mass: 0.9,
} as const

export function MotionPage({ routeKey, children }: PropsWithChildren<{ routeKey: string }>) {
  const { shouldAnimate } = useMotionPreference()
  if (!shouldAnimate) {
    return <>{children}</>
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0, y: 42, scale: 0.96, rotateX: -6 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        exit={{ opacity: 0, y: -28, scale: 0.98, rotateX: 4 }}
        transition={{ ...MOTION_TRANSITION, duration: 0.75 }}
        style={{ transformOrigin: 'top center', width: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

export function MotionSection({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) {
  const { shouldAnimate } = useMotionPreference()
  if (!shouldAnimate) {
    return <>{children}</>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...MOTION_TRANSITION, delay, duration: 0.65 }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}

export function MotionCard({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) {
  const { shouldAnimate } = useMotionPreference()
  if (!shouldAnimate) {
    return <>{children}</>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 26, scale: 0.9, rotate: -1.5 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      whileHover={{ scale: 1.04, rotate: 0.6, y: -8 }}
      whileTap={{ scale: 0.96, rotate: -0.6 }}
      transition={{ ...MOTION_TRANSITION, delay, duration: 0.7 }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}

export function MotionListItem({ children }: PropsWithChildren) {
  const { shouldAnimate } = useMotionPreference()
  if (!shouldAnimate) {
    return <>{children}</>
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -14, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      whileHover={{ x: 8, scale: 1.02 }}
      transition={{ ...MOTION_TRANSITION, duration: 0.5 }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}
