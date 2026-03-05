import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import type { TargetAndTransition, Transition } from 'framer-motion'
import type { MouseEvent, PropsWithChildren } from 'react'
import { useMemo, useRef } from 'react'
import { useMotionPreference } from './MotionProvider'

// ─── Random utils ─────────────────────────────────────────────────────────────

const rnd  = (min: number, max: number) => min + Math.random() * (max - min)
const rndI = (min: number, max: number) => Math.floor(rnd(min, max + 1))
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

// ─── Spring presets — from gentle to completely unhinged ──────────────────────

export const MOTION_TRANSITION = { type: 'spring', stiffness: 240, damping: 14, mass: 0.9 } as const
const SPRING_SNAPPY = { type: 'spring', stiffness: 700, damping: 22, mass: 0.5 } as const
const SPRING_BOUNCY = { type: 'spring', stiffness: 420, damping: 9,  mass: 0.8 } as const
const SPRING_INSANE = { type: 'spring', stiffness: 1400, damping: 7, mass: 0.3 } as const
const SPRING_HEAVY  = { type: 'spring', stiffness: 160, damping: 20, mass: 3.5 } as const
const SPRING_JELLO  = { type: 'spring', stiffness: 320, damping: 5,  mass: 1.2 } as const

// Random spring — different physics every call
function randomSpring() {
  return {
    type: 'spring' as const,
    stiffness: rnd(220, 1100),
    damping:   rnd(5, 20),
    mass:      rnd(0.3, 1.8),
  }
}

export type MotionFlavor   = 'tilt' | 'flip' | 'orbit' | 'pulse' | 'slam' | 'elastic' | 'vortex' | 'ricochet'
export type SectionVariant = 'rise' | 'swing' | 'spiral' | 'slam' | 'cascade' | 'warp'

const ALL_FLAVORS:   readonly MotionFlavor[]   = ['tilt','flip','orbit','pulse','slam','elastic','vortex','ricochet']
const ALL_VARIANTS:  readonly SectionVariant[] = ['rise','swing','spiral','slam','cascade','warp']

// ─── Page variant pool — chosen fresh every route change ─────────────────────

function buildPageVariants() {
  return [
    // BARREL ROLL
    { initial: { opacity:0, scale:0.2, rotate:360, y:200, filter:'blur(8px)' },
      animate: { opacity:1, scale:1,   rotate:0,   y:0,   filter:'blur(0px)' },
      exit:    { opacity:0, scale:0.2, rotate:-360, y:-200, filter:'blur(8px)' }, spring: SPRING_BOUNCY },
    // IMPLOSION
    { initial: { opacity:0, scale:4,    rotate:-10, filter:'blur(28px)' },
      animate: { opacity:1, scale:1,    rotate:0,   filter:'blur(0px)' },
      exit:    { opacity:0, scale:0.05, rotate:15,  filter:'blur(20px)' }, spring: SPRING_HEAVY },
    // SLAM
    { initial: { opacity:0, y:-900, scale:0.55, skewX:-8 },
      animate: { opacity:1, y:0,    scale:1,    skewX:0  },
      exit:    { opacity:0, y:700,  scale:0.6,  skewX:6  }, spring: SPRING_BOUNCY },
    // VORTEX
    { initial: { opacity:0, scale:0.01, rotate:-540 },
      animate: { opacity:1, scale:1,    rotate:0    },
      exit:    { opacity:0, scale:0.01, rotate:540  }, spring: SPRING_JELLO },
    // CANNON SHOT
    { initial: { opacity:0, x:-500, y:350,  scale:0.3, rotate:35  },
      animate: { opacity:1, x:0,    y:0,    scale:1,   rotate:0   },
      exit:    { opacity:0, x:500,  y:-280, scale:0.35, rotate:-25 }, spring: SPRING_SNAPPY },
    // TIME WARP
    { initial: { opacity:0, scaleX:0.02, scaleY:3.5, filter:'blur(16px)' },
      animate: { opacity:1, scaleX:1,    scaleY:1,   filter:'blur(0px)' },
      exit:    { opacity:0, scaleX:3.5,  scaleY:0.02, filter:'blur(16px)' }, spring: SPRING_BOUNCY },
    // GLITCH
    { initial: { opacity:0, x:140, skewX:30, scaleY:0.6, filter:'blur(6px)' },
      animate: { opacity:1, x:0,   skewX:0,  scaleY:1,   filter:'blur(0px)' },
      exit:    { opacity:0, x:-110, skewX:-25, scaleY:0.65, filter:'blur(6px)' }, spring: SPRING_INSANE },
    // RUBBER BAND
    { initial: { opacity:0, x:220, rotate:16, scale:0.75, skewY:8  },
      animate: { opacity:1, x:0,   rotate:0,  scale:1,    skewY:0  },
      exit:    { opacity:0, x:-180, rotate:-12, scale:0.8, skewY:-6 }, spring: SPRING_JELLO },
    // SPLIT — enters from both sides simultaneously (two halves)
    { initial: { opacity:0, scaleX:0, skewX:-18 },
      animate: { opacity:1, scaleX:1, skewX:0   },
      exit:    { opacity:0, scaleX:0, skewX:18  }, spring: SPRING_SNAPPY },
    // DROP + BOUNCE
    { initial: { opacity:0, y:-600, scale:0.4, rotate:rnd(-20,20) },
      animate: { opacity:1, y:0,    scale:1,   rotate:0            },
      exit:    { opacity:0, y:500,  scale:0.5, rotate:rnd(-15,15)  }, spring: { ...SPRING_BOUNCY, stiffness: rnd(300,700), damping: rnd(6,12) } },
    // DIAGONAL SLIDE
    { initial: { opacity:0, x: rnd(200,500)*pick([-1,1]), y: rnd(100,300)*pick([-1,1]), rotate: rnd(10,25)*pick([-1,1]) },
      animate: { opacity:1, x:0, y:0, rotate:0 },
      exit:    { opacity:0, x: rnd(200,400)*pick([-1,1]), y: rnd(100,250)*pick([-1,1]) }, spring: randomSpring() },
    // QUANTUM TUNNEL — pops in from nowhere with blur focus
    { initial: { opacity:0, scale:1.8, filter:`blur(${rnd(15,30)}px)`, rotate:rnd(-8,8) },
      animate: { opacity:1, scale:1,   filter:'blur(0px)',              rotate:0         },
      exit:    { opacity:0, scale:0.2, filter:`blur(${rnd(10,20)}px)`                   }, spring: { ...SPRING_HEAVY, mass: rnd(2,5) } },
  ]
}

// ─── MotionPage ───────────────────────────────────────────────────────────────

export function MotionPage({ routeKey, children }: PropsWithChildren<{ routeKey: string }>) {
  const { shouldAnimate } = useMotionPreference()
  // Re-randomize every time routeKey changes (each navigation)
  const v = useMemo(() => pick(buildPageVariants()), [routeKey])

  if (!shouldAnimate) return <>{children}</>

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={v.initial}
        animate={v.animate}
        exit={v.exit}
        transition={{ ...v.spring, duration: 1.1 }}
        style={{ transformOrigin: 'center center', width: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// ─── MotionSection ────────────────────────────────────────────────────────────

const SECTION_CONFIGS: Record<SectionVariant, { initial: TargetAndTransition; spring: Transition }> = {
  rise:    { initial: { opacity:0, y:70,  scale:0.88 },                              spring: SPRING_BOUNCY },
  swing:   { initial: { opacity:0, x:-80, rotate:-14, scale:0.85 },                  spring: SPRING_BOUNCY },
  spiral:  { initial: { opacity:0, scale:0.4, rotate:-270 },                         spring: SPRING_JELLO  },
  slam:    { initial: { opacity:0, y:-220, scale:0.65, skewX:-6 },                   spring: SPRING_BOUNCY },
  cascade: { initial: { opacity:0, x:100, scaleX:0.2, skewX:20 },                   spring: SPRING_SNAPPY },
  warp:    { initial: { opacity:0, scaleX:4, scaleY:0.08, filter:'blur(10px)' },     spring: SPRING_BOUNCY },
}

export function MotionSection({
  children,
  delay = 0,
  variant,
}: PropsWithChildren<{ delay?: number; variant?: SectionVariant }>) {
  const { shouldAnimate } = useMotionPreference()
  // Randomize amplitude multiplier on mount — same variant, wilder or subtler each time
  const ampRef = useRef<number>(0)
  if (ampRef.current === 0) ampRef.current = rnd(0.65, 1.7)
  const springRef = useRef<Transition | null>(null)
  if (!springRef.current) springRef.current = { ...randomSpring(), delay }

  // Random variant if not specified; re-roll never (captured on mount)
  const effectiveVariant = useMemo(() => variant ?? pick(ALL_VARIANTS), [variant])

  if (!shouldAnimate) return <>{children}</>

  const { initial } = SECTION_CONFIGS[effectiveVariant]

  // Scale up/down the entry distances by the random amplitude factor
  const scaledInitial = Object.fromEntries(
    Object.entries(initial).map(([k, v]) =>
      typeof v === 'number' && k !== 'opacity' && k !== 'scale'
        ? [k, v * ampRef.current]
        : [k, v]
    )
  )

  return (
    <motion.div
      initial={scaledInitial}
      animate={{ opacity:1, y:0, x:0, scale:1, rotate:0, scaleX:1, scaleY:1, skewX:0, filter:'blur(0px)' }}
      transition={springRef.current}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}

// ─── MotionCard ───────────────────────────────────────────────────────────────

const CARD_ENTRIES: Record<MotionFlavor, TargetAndTransition> = {
  tilt:     { opacity:0, y:60,  scale:0.75, rotate:-6  },
  flip:     { opacity:0, scaleX:0.04, y:30, scale:0.9  },
  orbit:    { opacity:0, x:-80, y:60, rotate:-30, scale:0.6 },
  pulse:    { opacity:0, scale:0.05                         },
  slam:     { opacity:0, y:-160, scale:0.5, skewX:-10       },
  elastic:  { opacity:0, scaleY:0.04, scaleX:1.6, y:20      },
  vortex:   { opacity:0, scale:0.01, rotate:-450             },
  ricochet: { opacity:0, x:280, rotate:28, scale:0.5         },
}

const CARD_SPRINGS: Record<MotionFlavor, Transition> = {
  tilt:     SPRING_BOUNCY,
  flip:     SPRING_INSANE,
  orbit:    SPRING_JELLO,
  pulse:    SPRING_INSANE,
  slam:     SPRING_BOUNCY,
  elastic:  SPRING_SNAPPY,
  vortex:   SPRING_JELLO,
  ricochet: SPRING_SNAPPY,
}

interface CardConfig {
  flavor:    MotionFlavor
  tiltRange: number   // mouse tilt degrees
  spring:    Transition
  idleDur:   number
  idleAmp:   number   // multiplier for idle amplitudes
  idleRot:   number   // max idle rotation
}

function randomCardConfig(): CardConfig {
  return {
    flavor:    pick(ALL_FLAVORS),
    tiltRange: rnd(10, 28),
    spring:    randomSpring(),
    idleDur:   rnd(2.4, 6.5),
    idleAmp:   rnd(0.5, 2.5),
    idleRot:   rnd(0.3, 2.5),
  }
}

function cardIdle(cfg: CardConfig): TargetAndTransition {
  const a = cfg.idleAmp
  const r = cfg.idleRot
  switch (cfg.flavor) {
    case 'tilt':     return { y:[0,-6*a,0,6*a,0], rotate:[0,r,0,-r,0] }
    case 'flip':     return { rotateY:[0,7*a,0,-7*a,0], y:[0,-4*a,0] }
    case 'orbit':    return { x:[0,6*a,0,-6*a,0], y:[0,-6*a,6*a,-2*a,0], rotate:[0,r,-r*0.6,0] }
    case 'pulse':    return { scale:[1,1+0.06*a,1,1+0.03*a,1], filter:['brightness(1)',`brightness(${1+0.15*a})`, 'brightness(1)'] }
    case 'slam':     return { y:[0,-8*a,2*a,-4*a,0], scale:[1,1+0.02*a,0.99,1] }
    case 'elastic':  return { scaleY:[1,1+0.04*a,1-0.03*a,1+0.02*a,1], scaleX:[1,1-0.03*a,1+0.03*a,0.99,1] }
    case 'vortex':   return { rotate:[0,360] }  // perpetual spin
    case 'ricochet': return { x:[0,4*a,-3*a,2*a,0], rotate:[0,r,-r*0.7,r*0.3,0] }
    default:         return { y:[0,-4*a,0,4*a,0] }
  }
}

function cardIdleTransition(cfg: CardConfig): Transition {
  if (cfg.flavor === 'vortex') {
    return { duration: cfg.idleDur * 1.8, repeat: Infinity, ease: 'linear' as const }
  }
  return { duration: cfg.idleDur, repeat: Infinity, ease: 'easeInOut' as const, repeatType: 'mirror' as const }
}

export function MotionCard({
  children,
  delay = 0,
  flavor = 'tilt',
  index = 0,
}: PropsWithChildren<{ delay?: number; flavor?: MotionFlavor; index?: number }>) {
  const { shouldAnimate } = useMotionPreference()

  // All hooks unconditional — rules of hooks
  const ref = useRef<HTMLDivElement>(null)
  const cfgRef = useRef<CardConfig | null>(null)
  if (!cfgRef.current) cfgRef.current = randomCardConfig()
  const cfg = cfgRef.current

  const tiltRange = cfg.tiltRange
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const rotateXBase = useTransform(mouseY, [-0.5, 0.5], [tiltRange, -tiltRange])
  const rotateYBase = useTransform(mouseX, [-0.5, 0.5], [-tiltRange, tiltRange])
  const rotateX = useSpring(rotateXBase, { stiffness: 350, damping: 32 })
  const rotateY = useSpring(rotateYBase, { stiffness: 350, damping: 32 })
  const hoverScale = useSpring(1, { stiffness: 350, damping: 32 })

  if (!shouldAnimate) return <>{children}</>

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5)
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5)
    hoverScale.set(1 + rnd(0.04, 0.10))
  }
  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
    hoverScale.set(1)
  }

  const entryDelay = delay + (index || 0) * rnd(0.02, 0.06)

  return (
    <motion.div
      initial={CARD_ENTRIES[cfg.flavor]}
      animate={{ opacity:1, y:0, x:0, scale:1, rotate:0, scaleX:1, scaleY:1, skewX:0, rotateY:0 }}
      transition={{ ...cfg.spring, delay: entryDelay }}
      whileTap={{ scale: rnd(0.87, 0.94), rotate: rnd(-2.5, 2.5) }}
      style={{ width: '100%' }}
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ width:'100%', perspective:900, rotateX, rotateY, scale: hoverScale, transformStyle:'preserve-3d' }}
      >
        <motion.div
          animate={cardIdle(cfg)}
          transition={cardIdleTransition(cfg)}
          style={{ width: '100%' }}
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// ─── MotionListItem ───────────────────────────────────────────────────────────

const LIST_ENTRIES: Record<MotionFlavor, TargetAndTransition> = {
  tilt:     { opacity:0, x:-40, rotateY:18, scale:0.92 },
  flip:     { opacity:0, x:-30, rotateY:30, scale:0.85 },
  orbit:    { opacity:0, x:-28, y:18, rotate:-10, scale:0.88 },
  pulse:    { opacity:0, y:30,  scale:0.75 },
  slam:     { opacity:0, y:-50, scale:0.8, skewX:-5 },
  elastic:  { opacity:0, scaleX:0.1, x:-30 },
  vortex:   { opacity:0, scale:0.2, rotate:-120 },
  ricochet: { opacity:0, x:-80, rotate:-14, scale:0.8 },
}

const LIST_HOVERS: Record<MotionFlavor, TargetAndTransition> = {
  tilt:     { x:16, scale:1.04, rotateY:-8  },
  flip:     { x:14, scale:1.05, rotateY:-10 },
  orbit:    { x:18, scale:1.04, rotate:2.5  },
  pulse:    { scale:1.07, x:10, filter:'brightness(1.1)' },
  slam:     { x:12, y:-4, scale:1.04 },
  elastic:  { scaleX:1.06, x:10 },
  vortex:   { x:12, rotate:5, scale:1.05 },
  ricochet: { x:18, scale:1.05, rotate:1.5 },
}

export function MotionListItem({
  children,
  index = 0,
  flavor,
}: PropsWithChildren<{ index?: number; flavor?: MotionFlavor }>) {
  const { shouldAnimate } = useMotionPreference()
  const flavorRef = useRef<MotionFlavor | null>(null)
  if (!flavorRef.current) flavorRef.current = flavor ?? pick(ALL_FLAVORS)
  const delayRef = useRef<number>(0)
  if (delayRef.current === 0) delayRef.current = index * rnd(0.015, 0.045)

  if (!shouldAnimate) return <>{children}</>
  const f = flavorRef.current

  return (
    <motion.div
      initial={LIST_ENTRIES[f]}
      animate={{ opacity:1, x:0, y:0, rotate:0, rotateY:0, scale:1, scaleX:1, skewX:0, filter:'brightness(1)' }}
      whileHover={LIST_HOVERS[f]}
      whileTap={{ scale: rnd(0.90, 0.95), x: rnd(3, 8) }}
      transition={{ ...randomSpring(), delay: delayRef.current }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}

// ─── MotionSlam ───────────────────────────────────────────────────────────────

export function MotionSlam({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) {
  const { shouldAnimate } = useMotionPreference()
  const cfgRef = useRef<{ y: number; rotate: number; skewX: number } | null>(null)
  if (!cfgRef.current) cfgRef.current = { y: -rnd(300, 600), rotate: rnd(-25, 25), skewX: rnd(-15, 15) }
  if (!shouldAnimate) return <>{children}</>
  const c = cfgRef.current

  return (
    <motion.div
      initial={{ opacity:0, y:c.y, scale:rnd(0.3,0.6), rotate:c.rotate, skewX:c.skewX }}
      animate={{ opacity:1, y:0,   scale:1,            rotate:0,         skewX:0       }}
      transition={{ ...SPRING_BOUNCY, delay }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}

// ─── MotionPop ────────────────────────────────────────────────────────────────

export function MotionPop({
  children,
  delay = 0,
  index = 0,
}: PropsWithChildren<{ delay?: number; index?: number }>) {
  const { shouldAnimate } = useMotionPreference()
  const cfgRef = useRef<{ initRot: number; hoverScale: number; hoverRot: number } | null>(null)
  if (!cfgRef.current) cfgRef.current = { initRot: -rnd(30, 90), hoverScale: rnd(1.15, 1.4), hoverRot: rnd(8, 22) * pick([-1, 1]) }
  if (!shouldAnimate) return <>{children}</>
  const c = cfgRef.current

  return (
    <motion.span
      initial={{ opacity:0, scale:0, rotate:c.initRot }}
      animate={{ opacity:1, scale:1, rotate:0         }}
      whileHover={{ scale:c.hoverScale, rotate:c.hoverRot, y:-rnd(2,6) }}
      whileTap={{ scale:rnd(0.75, 0.88), rotate:-c.hoverRot * 0.7 }}
      transition={{ ...SPRING_INSANE, delay: delay + index * rnd(0.03, 0.06) }}
      style={{ display: 'inline-block' }}
    >
      {children}
    </motion.span>
  )
}

// ─── MotionText ───────────────────────────────────────────────────────────────

export function MotionText({
  text,
  className,
  delay = 0,
}: {
  text: string
  className?: string
  delay?: number
}) {
  const { shouldAnimate } = useMotionPreference()
  // Randomize per-char stagger, initial y drop, and rotation on mount
  const cfgRef = useRef<{ stagger: number; dropY: number; dropRot: number } | null>(null)
  if (!cfgRef.current) cfgRef.current = { stagger: rnd(0.02, 0.06), dropY: rnd(30, 80), dropRot: rnd(15, 40) * pick([-1, 1]) }
  if (!shouldAnimate) return <span className={className}>{text}</span>
  const { stagger, dropY, dropRot } = cfgRef.current

  return (
    <span className={className} style={{ display: 'inline-block' }}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity:0, y:dropY, rotate:dropRot * (i % 2 === 0 ? 1 : -1), scale:rnd(0.3, 0.6) }}
          animate={{ opacity:1, y:0,     rotate:0,                                  scale:1              }}
          transition={{ ...randomSpring(), delay: delay + i * stagger }}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  )
}

// ─── MotionPingPong ───────────────────────────────────────────────────────────
// Procedurally generated random trajectory every mount.
// scaleX/scaleY squish encodes rubber-ball physics at each wall impact.

interface PingPongPath {
  x:      number[]
  y:      number[]
  rotate: number[]
  scaleX: number[]
  scaleY: number[]
  times:  number[]
}

function generatePingPongPath(): PingPongPath {
  const edge     = rndI(0, 3)                   // which screen edge to fire from
  const distance = rnd(360, 620)                 // how far off-screen
  const along    = (Math.random() - 0.5) * 0.8  // position along that edge

  let sx: number, sy: number
  switch (edge) {
    case 0: sx = along * 900;  sy = -distance; break  // top
    case 1: sx = distance;     sy = along * 700; break // right
    case 2: sx = along * 900;  sy = distance;  break  // bottom
    default: sx = -distance;   sy = along * 700; break // left
  }

  const bounceCount    = rndI(2, 5)
  const decayRate      = rnd(0.35, 0.58)   // energy lost per bounce
  const squishBase     = rnd(0.42, 0.70)   // how flat the panel squishes at first impact
  const spinStart      = rnd(10, 28) * (Math.random() > 0.5 ? 1 : -1)

  const x      = [sx], y      = [sy]
  const rotate = [spinStart]
  const scaleX = [1],  scaleY = [1]
  const times  = [0]

  let cx = sx, cy = sy
  let xDir = -Math.sign(sx) || 1
  let yDir = -Math.sign(sy) || -1
  let ampX = Math.abs(sx), ampY = Math.abs(sy)

  for (let b = 0; b < bounceCount; b++) {
    // Decay amplitude with random per-bounce variation
    ampX *= decayRate * rnd(0.82, 1.15)
    ampY *= decayRate * rnd(0.82, 1.15)
    cx = xDir * ampX
    cy = yDir * ampY

    // Wall-impact squish (gets less dramatic with each bounce)
    const sqY = Math.min(0.98, squishBase + b * rnd(0.05, 0.10))
    const sqX = (1 / sqY) * rnd(0.88, 0.97)  // inverse, slight area loss

    x.push(cx);  y.push(cy)
    scaleX.push(sqX); scaleY.push(sqY)
    // Spin reverses, decays
    rotate.push(-rotate[rotate.length - 1] * rnd(0.40, 0.68))

    // Strictly increasing times spread across 0 → 0.86
    const baseT   = ((b + 1) / (bounceCount + 1)) * 0.86
    const jitter  = rnd(-0.025, 0.025)
    const prevT   = times[times.length - 1]
    times.push(Math.min(0.85, Math.max(prevT + 0.09, baseT + jitter)))

    xDir *= -1; yDir *= -1
  }

  // Settle
  x.push(0); y.push(0); rotate.push(0); scaleX.push(1); scaleY.push(1); times.push(1)

  return { x, y, rotate, scaleX, scaleY, times }
}

export function MotionPingPong({
  children,
  delay = 0,
  index = 0,
}: PropsWithChildren<{ delay?: number; index?: number }>) {
  const { shouldAnimate } = useMotionPreference()

  // Generate a fresh random path on each mount — never the same trajectory twice
  const pathRef = useRef<PingPongPath | null>(null)
  if (!pathRef.current) pathRef.current = generatePingPongPath()

  if (!shouldAnimate) return <>{children}</>

  const path = pathRef.current
  const dur  = rnd(1.4, 2.0) + (index % 4) * rnd(0.06, 0.15)

  return (
    <motion.div
      initial={{ opacity:0, x:path.x[0], y:path.y[0], rotate:path.rotate[0] }}
      animate={{
        opacity: 1,
        x:      path.x,
        y:      path.y,
        rotate: path.rotate,
        scaleX: path.scaleX,
        scaleY: path.scaleY,
      }}
      transition={{
        opacity: { duration: 0.1, delay },
        x:       { duration: dur, times: path.times, ease: 'linear', delay },
        y:       { duration: dur, times: path.times, ease: 'linear', delay },
        rotate:  { duration: dur, times: path.times, ease: 'linear', delay },
        scaleX:  { duration: dur, times: path.times, ease: 'linear', delay },
        scaleY:  { duration: dur, times: path.times, ease: 'linear', delay },
      }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  )
}

// ─── MotionBurst ──────────────────────────────────────────────────────────────

export function MotionBurst({ children, delay = 0 }: PropsWithChildren<{ delay?: number }>) {
  const { shouldAnimate } = useMotionPreference()
  // Randomize burst geometry once on mount
  const cfgRef = useRef<{ count: number; radius: number; hueOffset: number } | null>(null)
  if (!cfgRef.current) cfgRef.current = { count: rndI(5, 14), radius: rnd(40, 100), hueOffset: rnd(0, 360) }
  if (!shouldAnimate) return <>{children}</>

  const { count, radius, hueOffset } = cfgRef.current

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => {
        const angle  = (i / count) * 360
        const rad    = (angle * Math.PI) / 180
        const spread = rnd(1.8, 3.5)
        const rx     = Math.cos(rad) * radius
        const ry     = Math.sin(rad) * radius
        return (
          <motion.div
            key={i}
            initial={{ opacity:1, x:rx, y:ry, scale:rnd(0.8, 1.6) }}
            animate={{ opacity:0, x:rx * spread, y:ry * spread, scale:0 }}
            transition={{ duration: rnd(0.4, 0.7), delay: delay + rnd(0.03, 0.1), ease: 'easeOut' }}
            style={{
              position: 'absolute', top: '50%', left: '50%',
              width: rndI(4, 12), height: rndI(4, 12), borderRadius: '50%',
              background: `hsl(${(hueOffset + i * (360 / count)) % 360}, ${rnd(70,100)}%, 60%)`,
              pointerEvents: 'none', zIndex: 10,
            }}
          />
        )
      })}
      <motion.div
        initial={{ opacity:0, scale:rnd(0.03,0.12), rotate:rnd(-270,270) }}
        animate={{ opacity:1, scale:1,              rotate:0              }}
        transition={{ ...SPRING_BOUNCY, delay }}
        style={{ width: '100%' }}
      >
        {children}
      </motion.div>
    </div>
  )
}
