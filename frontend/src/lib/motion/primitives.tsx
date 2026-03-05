import { AnimatePresence, motion } from 'framer-motion'
import type { PropsWithChildren } from 'react'
import { useMotionPreference } from './MotionProvider'

export const MOTION_TRANSITION = {
  type: 'spring',
  stiffness: 240,
  damping: 14,
  mass: 0.9,
} as const

type MotionFlavor = 'tilt' | 'flip' | 'orbit' | 'pulse'
type SectionVariant = 'rise' | 'swing' | 'spiral'

function hashSeed(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000
  }
  return hash
}

function pickPageVariant(routeKey: string) {
  const variant = hashSeed(routeKey) % 4

  if (variant === 0) {
    return {
      initial: { opacity: 0, y: 56, scale: 0.9, rotateX: -16, rotateY: 8 },
      animate: { opacity: 1, y: 0, scale: 1, rotateX: 0, rotateY: 0 },
      exit: { opacity: 0, y: -42, scale: 0.95, rotateX: 8, rotateY: -4 },
    }
  }

  if (variant === 1) {
    return {
      initial: { opacity: 0, x: 96, scale: 0.88, rotate: 6 },
      animate: { opacity: 1, x: 0, scale: 1, rotate: 0 },
      exit: { opacity: 0, x: -72, scale: 0.94, rotate: -4 },
    }
  }

  if (variant === 2) {
    return {
      initial: { opacity: 0, y: 32, scale: 0.82, rotate: -8, filter: 'blur(8px)' },
      animate: { opacity: 1, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' },
      exit: { opacity: 0, y: -24, scale: 0.9, rotate: 5, filter: 'blur(6px)' },
    }
  }

  return {
    initial: { opacity: 0, x: -92, y: 22, scale: 0.9, rotateY: -12 },
    animate: { opacity: 1, x: 0, y: 0, scale: 1, rotateY: 0 },
    exit: { opacity: 0, x: 80, y: -18, scale: 0.94, rotateY: 10 },
  }
}

export function MotionPage({ routeKey, children }: PropsWithChildren<{ routeKey: string }>) {
  const { shouldAnimate } = useMotionPreference()
  if (!shouldAnimate) {
    return <>{children}</>
  }

  const variant = pickPageVariant(routeKey)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={variant.initial}
        animate={variant.animate}
        exit={variant.exit}
        transition={{ ...MOTION_TRANSITION, duration: 0.85 }}
        style={{ transformOrigin: 'top center', width: '100%' }}
      >
        <motion.div
          animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.02, 1], rotate: [0, 0.4, 0] }}
          transition={{ duration: 7, ease: 'easeInOut', repeat: Number.POSITIVE_INFINITY }}
          style={{ width: '100%' }}
        >
        {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export function MotionSection({
  children,
  delay = 0,
  variant = 'rise',
}: PropsWithChildren<{ delay?: number; variant?: SectionVariant }>) {
  const { shouldAnimate } = useMotionPreference()
  if (!shouldAnimate) {
    return <>{children}</>
  }

  const initial = variant === 'swing'
    ? { opacity: 0, y: 18, x: -12, rotate: -3, scale: 0.98 }
    : variant === 'spiral'
      ? { opacity: 0, y: 26, rotate: -8, scale: 0.92 }
      : { opacity: 0, y: 24, scale: 0.98 }

  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }}
      transition={{ ...MOTION_TRANSITION, delay, duration: 0.65 }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}

export function MotionCard({
  children,
  delay = 0,
  flavor = 'tilt',
  index = 0,
}: PropsWithChildren<{ delay?: number; flavor?: MotionFlavor; index?: number }>) {
  const { shouldAnimate } = useMotionPreference()
  if (!shouldAnimate) {
    return <>{children}</>
  }

  const initial = flavor === 'flip'
    ? { opacity: 0, y: 34, scale: 0.85, rotateY: 18 }
    : flavor === 'orbit'
      ? { opacity: 0, y: 22, x: -18, scale: 0.9, rotate: -6 }
      : flavor === 'pulse'
        ? { opacity: 0, y: 18, scale: 0.8 }
        : { opacity: 0, y: 26, scale: 0.9, rotate: -2 }

  const hover = flavor === 'flip'
    ? { scale: 1.07, rotateY: -6, rotateX: 4, y: -9 }
    : flavor === 'orbit'
      ? { scale: 1.08, rotate: 3, x: 8, y: -10 }
      : flavor === 'pulse'
        ? { scale: 1.1, y: -7, boxShadow: '0 22px 40px rgba(32, 129, 226, 0.35)' }
        : { scale: 1.05, rotate: 1.2, y: -8 }

  const loopDuration = 3.2 + (index % 5) * 0.45

  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0, rotateX: 0, rotateY: 0 }}
      whileHover={hover}
      whileTap={{ scale: 0.93, rotate: -1.2 }}
      transition={{ ...MOTION_TRANSITION, delay, duration: 0.7 }}
      style={{ width: '100%' }}
    >
      <motion.div
        animate={{
          y: [0, -3, 0, 3, 0],
          rotate: [0, 0.4, 0, -0.3, 0],
          scale: [1, 1.01, 1, 0.995, 1],
        }}
        transition={{ duration: loopDuration, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        style={{ width: '100%' }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

export function MotionListItem({
  children,
  index = 0,
  flavor = 'tilt',
}: PropsWithChildren<{ index?: number; flavor?: MotionFlavor }>) {
  const { shouldAnimate } = useMotionPreference()
  if (!shouldAnimate) {
    return <>{children}</>
  }

  const entry = flavor === 'flip'
    ? { opacity: 0, x: -20, rotateY: 12, scale: 0.95 }
    : flavor === 'orbit'
      ? { opacity: 0, x: -12, y: 10, rotate: -4, scale: 0.96 }
      : flavor === 'pulse'
        ? { opacity: 0, y: 16, scale: 0.92 }
        : { opacity: 0, x: -14, scale: 0.98 }

  return (
    <motion.div
      initial={entry}
      animate={{ opacity: 1, x: 0, y: 0, rotate: 0, rotateY: 0, scale: 1 }}
      whileHover={{ x: 10, scale: 1.03, rotate: 0.4 }}
      transition={{ ...MOTION_TRANSITION, duration: 0.55, delay: index * 0.02 }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}
