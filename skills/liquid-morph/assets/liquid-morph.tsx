'use client'
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

/** Liquid morph. A trigger with a data-morph-id inside a [data-morph-root]
 *  pours into a panel, a bottom sheet by default or wherever `place` puts it,
 *  and pours back into the trigger when it closes. React and react-dom are the
 *  only dependencies. */

type Rect = { x: number; y: number; w: number; h: number; r?: number }
type Phase = 'idle' | 'opening' | 'open' | 'closing' | 'landed'
type Edge = 'top' | 'bottom' | 'left' | 'right'

/** Playback rate for every morph inside it: 0.25 runs at quarter speed. */
export const MorphSpeed = createContext(1)

export interface MorphProps {
  open: boolean
  /** data-morph-id of the trigger: the liquid grows from it and lands back on it. */
  source: string
  /** Panel colour. The liquid blends from the trigger's own background to this. */
  panel: string
  radius: number
  /** Where the panel rests inside the root, as absolute-position styles such as
   *  `{ top: 16, right: 24, width: 320 }`. Unset, the panel is a bottom sheet. */
  place?: CSSProperties
  /** Gap between the sheet and the root's left, right and bottom edges. Defaults to 8. Ignored with `place`. */
  inset?: number
  /** Colour laid over the root's content at full openness. `false` makes the panel
   *  non-modal: no scrim, no Escape dismissal, and the page stays interactive. */
  scrim?: string | false
  /** Scale [data-morph-recede] shrinks to at full openness. */
  recede?: number
  /** CSS box-shadow syntax. It grows in with the liquid. */
  shadow?: string
  /** Drag the panel down to dismiss it. */
  drag?: boolean
  label: string
  /** The trigger's content. It resolves from blur where the liquid lands, and is inert. */
  ghost: ReactNode
  children: ReactNode
  onDismiss?: () => void
  /** Runs once the liquid has landed back on the trigger. */
  onLanded?: () => void
  className?: string
  /** Distance kept free above the sheet; it never grows into it. Ignored with `place`. */
  top?: number
}

const BLUR = 10
const CONTRAST = 22
const PAD = BLUR * 3 + 24
/** The goo filter's alpha matrix at strength `s`: full contrast in flight, identity at rest. */
const gooMatrix = (s: number) => {
  const c = 1 + (CONTRAST - 1) * s
  return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${c.toFixed(3)} ${Math.min(0, 0.5 - c * (5 / 12)).toFixed(3)}`
}
/** Flight time grows with how far the liquid's farthest edge travels, from a short hop (NEAR px)
 *  to a long pour (FAR px): a bigger element is heavier, so it takes longer. Closing is shorter
 *  than opening, and a content resize is shortest. Values are ms at NEAR and at FAR. */
const NEAR = 60
const FAR = 560
const TIMING = { open: [190, 340], close: [170, 300], size: [160, 280] } as const
type Flight = keyof typeof TIMING
const FADE_MS = 200
const CORNER = 24
const LENS = 14
const LABEL_BLUR = 8
const CONTENT_BLUR = 6
const FADE_TAU = 0.03
const LAND_MAX = 800
const CARRY_TAU = 0.03
const TAIL = 1.35
const EDGE = BLUR * 0.15
/** The goo fades out over the last GOO_SPAN of openness, so the liquid settles into the trigger's
 *  exact shape (a 12 px corner stays 12 px) instead of a blur-rounded blob that snaps on landing. */
const GOO_SPAN = 0.15
/** The ghost's label copy keeps only the trigger's content: no fill, border, shadow or ::before ring. */
const LABEL_ONLY: CSSProperties = { background: 'none', borderColor: 'transparent', boxShadow: 'none', outline: 'none' }
const GHOST_CSS = '.m-ghost-label::before,.m-ghost-label::after{opacity:0!important}'
const PULL_START = 4
const PULL_DISTANCE = 110
const PULL_VELOCITY = 600

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const ramp = (q: number, a: number, b: number) => clamp01((q - a) / (b - a))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, u: number) => 3 * u * (1 - u) * (1 - u) * a + 3 * u * u * (1 - u) * b + u * u * u
  return (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let lo = 0
    let hi = 1
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < t) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}
/** Short hops ease gently; long pours front-load their motion (the iOS sheet curve) so the extra
 *  time reads as weight, not lag. Sizes in between blend the two. */
const CURVE_NEAR = [0.45, 0.6, 0.35, 1]
const CURVE_FAR = [0.32, 0.72, 0, 1]
const curveAt = (k: number) => bezier(...(CURVE_NEAR.map((c, i) => lerp(c, CURVE_FAR[i], k)) as [number, number, number, number]))
const ease = curveAt(0)
/** 0 for a short hop, 1 for a long pour. */
const weight = (px: number) => clamp01((px - NEAR) / (FAR - NEAR))

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function rgb(c: string): [number, number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(c.trim())
  if (hex) return [...[0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), 1] as [number, number, number, number]
  const fn = /^rgba?\(([^)]*)\)$/.exec(c.trim())
  if (fn) {
    const p = fn[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat)
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  return null
}
const alpha = (c: string, a: number) => {
  const C = rgb(c)
  return C ? `rgba(${C[0]}, ${C[1]}, ${C[2]}, ${(a * C[3]).toFixed(3)})` : c
}
const mix = (a: string, b: string, t: number) => {
  const A = rgb(a)
  const B = rgb(b)
  if (!A || !B) return t < 0.5 ? a : b
  return `rgb(${[0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t)).join(', ')})`
}
/** A trigger's fill, or the panel colour when it has none. */
const fillOf = (el: HTMLElement | null, panel: string) => {
  const c = el ? getComputedStyle(el).backgroundColor : ''
  const C = rgb(c)
  return C && C[3] > 0.5 ? c : panel
}

type Drop = { x: number; y: number; b: number; c: string }
const LENGTH = /^-?[\d.]+(px)?$/
/** Outer box-shadows as drop-shadows; inset shadows and spread have no drop-shadow form. */
function parseShadows(css = ''): Drop[] {
  return css.split(/,(?![^(]*\))/).flatMap((part) => {
    const tokens = part.trim().split(/\s+(?![^(]*\))/).filter(Boolean)
    if (tokens.includes('inset')) return []
    const n = tokens.filter((t) => LENGTH.test(t)).map(parseFloat)
    const c = tokens.find((t) => !LENGTH.test(t)) ?? 'rgba(0, 0, 0, 0.25)'
    return n.length >= 2 ? [{ x: n[0], y: n[1], b: n[2] ?? 0, c }] : []
  })
}
const shadowAt = (drops: Drop[], q: number) =>
  drops.map((d) => `drop-shadow(${(d.x * q).toFixed(2)}px ${(d.y * q).toFixed(2)}px ${(d.b * q).toFixed(2)}px ${alpha(d.c, q)})`).join(' ')

const written = new WeakMap<Element, Map<string, string>>()
function write(el: HTMLElement | SVGElement | null | undefined, prop: string, value: string) {
  if (!el) return
  let cache = written.get(el)
  if (!cache) written.set(el, (cache = new Map()))
  if (cache.get(prop) === value) return
  cache.set(prop, value)
  el.style.setProperty(prop, value)
}
function attr(el: SVGElement | null, name: string, value: string) {
  if (!el) return
  let cache = written.get(el)
  if (!cache) written.set(el, (cache = new Map()))
  if (cache.get(name) === value) return
  cache.set(name, value)
  el.setAttribute(name, value)
}
const forget = (el: Element | null) => el && written.delete(el)

const sameRect = (a: Rect, b: Rect, tol = 0.5) => Math.abs(a.x - b.x) < tol && Math.abs(a.y - b.y) < tol && Math.abs(a.w - b.w) < tol && Math.abs(a.h - b.h) < tol
const sameSize = (a: Rect, b: Rect, tol = 0.5) => Math.abs(a.w - b.w) < tol && Math.abs(a.h - b.h) < tol
/** How far the edge that moves most travels from a to b. */
const travel = (a: Rect, b: Rect) => Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.x + b.w - a.x - a.w), Math.abs(b.y + b.h - a.y - a.h))
/** How far `at` has come from a to b, read on whichever of width and height changes
 *  more. Null when that change is 1px or less. */
function progress(a: Rect, b: Rect, at: Rect): number | null {
  const wide = Math.abs(b.w - a.w) > Math.abs(b.h - a.h)
  const total = wide ? b.w - a.w : b.h - a.h
  return Math.abs(total) > 1 ? clamp01((wide ? at.w - a.w : at.h - a.h) / total) : null
}
/** The edge that travels furthest from a to b. Ties go to the first in top, bottom, left, right. */
function leadingEdge(a: Rect, b: Rect): Edge {
  const moved: [Edge, number][] = [
    ['top', Math.abs(b.y - a.y)],
    ['bottom', Math.abs(b.y + b.h - a.y - a.h)],
    ['left', Math.abs(b.x - a.x)],
    ['right', Math.abs(b.x + b.w - a.x - a.w)],
  ]
  return moved.reduce((best, m) => (m[1] > best[1] ? m : best))[0]
}

interface Anim {
  from: Required<Rect>
  to: Required<Rect>
  t0: number
  d: number
  vel: { x: number; y: number; w: number; h: number }
  edge: Edge
  ease: (t: number) => number
}
const STILL: Anim['vel'] = { x: 0, y: 0, w: 0, h: 0 }
const req = (r: Rect, fallbackR: number): Required<Rect> => ({ x: r.x, y: r.y, w: r.w, h: r.h, r: r.r ?? fallbackR })

const eased = (a: Anim, ta: number) => a.ease(a.d > 0 ? clamp01(ta / a.d) : 1)
function rectAt(a: Anim, ta: number): Required<Rect> {
  const e = eased(a, ta)
  const carry = ta * Math.exp(-ta / CARRY_TAU) * (1 - e)
  const w = lerp(a.from.w, a.to.w, e) + a.vel.w * carry
  const h = lerp(a.from.h, a.to.h, e) + a.vel.h * carry
  const r = lerp(a.from.r, a.to.r, e) + CORNER * 4 * e * (1 - e)
  return { x: lerp(a.from.x, a.to.x, e) + a.vel.x * carry, y: lerp(a.from.y, a.to.y, e) + a.vel.y * carry, w, h, r: Math.min(r, w / 2, h / 2) }
}

const EDGE_SPEED: Record<Edge, (v: Anim['vel']) => number> = {
  top: (v) => v.y,
  bottom: (v) => v.y + v.h,
  left: (v) => v.x,
  right: (v) => v.x + v.w,
}
/** The bulge ellipse on the leading edge, or null when that edge is too short to carry one. */
function lensOn(edge: Edge, R: Required<Rect>, amp: number) {
  if (edge === 'top' || edge === 'bottom') {
    if (R.w <= R.r * 2 + 8) return null
    return { cx: R.x + R.w / 2, cy: edge === 'top' ? R.y + EDGE + 2 : R.y + R.h - EDGE - 2, rx: R.w / 2 - R.r - 2, ry: amp + 2 }
  }
  if (R.h <= R.r * 2 + 8) return null
  return { cx: edge === 'left' ? R.x + EDGE + 2 : R.x + R.w - EDGE - 2, cy: R.y + R.h / 2, rx: amp + 2, ry: R.h / 2 - R.r - 2 }
}

interface Geo {
  dir: 'open' | 'close'
  from: Rect
  here: Rect
  target: Rect | null
  endFill: string
  lock: boolean
  anim: Anim
  dim: { from: number; t0: number; d: number; ease: (t: number) => number } | null
  bg: number
  lensAmp: number
  ride: number
  lastT: number
  t0: number
}

/** A rect in the root's own px, so the root can sit inside a scaled stage. */
function local(el: Element, root: HTMLElement): Rect {
  const s = root.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const k = s.width ? root.offsetWidth / s.width : 1
  return { x: (r.left - s.left) * k, y: (r.top - s.top) * k, w: r.width * k, h: r.height * k }
}

function measure(id: string, root: HTMLElement | null): Rect | null {
  const el = root?.querySelector<HTMLElement>(`[data-morph-id="${id}"]`)
  if (!el || !root) return null
  const r = local(el, root)
  if (!r.w) return null
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
  return { ...r, r: Math.min(radius, r.h / 2) }
}

const rectStyle = (r: Rect, max: number): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: Math.min(max, r.r ?? r.h / 2, r.h / 2) })

const FILL: CSSProperties = { position: 'absolute', inset: 0 }
const SVG_STYLE: CSSProperties = { ...FILL, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: -1, willChange: 'filter, transform' }
/** The ghost is a copy of the trigger (same tag, classes and inline look) that the
 *  liquid carries; these keep the trigger's own layout rules from placing it. */
type Look = { tag: string; className: string; style: CSSProperties }
const NO_LOOK: Look = { tag: 'div', className: '', style: {} }
const PLACED = /^(position|inset|left|top|right|bottom|width|height|min-|max-|margin|transform|translate|scale|rotate|visibility|opacity|filter|transition|animation|will-change|z-index)|radius$/
const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
function lookOf(el: HTMLElement | null): Look {
  if (!el) return NO_LOOK
  const style: Record<string, string> = {}
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style[i]
    if (!PLACED.test(name)) style[name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = el.style.getPropertyValue(name)
  }
  const tag = el.tagName.toLowerCase()
  return { tag: VOID_TAGS.has(tag) ? 'div' : tag, className: el.getAttribute('class') ?? '', style }
}
const GHOST_STYLE: CSSProperties = {
  position: 'absolute',
  right: 'auto',
  bottom: 'auto',
  margin: 0,
  transform: 'none',
  translate: 'none',
  scale: 'none',
  rotate: 'none',
  visibility: 'visible',
  pointerEvents: 'none',
  transition: 'none',
  opacity: 0,
  // A trigger's own z-index would lift the look copy over the label copy.
  zIndex: 'auto',
}
const scrimStyle = (background: string, interactive: boolean): CSSProperties => ({ ...FILL, zIndex: 70, borderRadius: 'inherit', background, pointerEvents: interactive ? 'auto' : 'none' })
const resting = (inset: number, radius: number, top?: number, place?: CSSProperties): CSSProperties =>
  place
    ? { ...place, borderRadius: radius }
    : {
        left: inset,
        right: inset,
        bottom: inset,
        borderRadius: radius,
        maxHeight: top !== undefined ? `calc(100% - ${top + inset}px)` : undefined,
      }

const REDUCED = '(prefers-reduced-motion: reduce)'
const onReducedChange = (cb: () => void) => {
  const m = matchMedia(REDUCED)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
const useReducedMotion = () => useSyncExternalStore(onReducedChange, () => matchMedia(REDUCED).matches, () => false)

/** The root holds every layer, so it must be their containing block. */
function useRoot(anchor: RefObject<HTMLDivElement | null>) {
  const root = useRef<HTMLElement | null>(null)
  const find = () => root.current ?? (root.current = anchor.current?.closest<HTMLElement>('[data-morph-root]') ?? null)
  useIsoLayoutEffect(() => {
    const el = find()
    if (!el) {
      console.warn('<Morph> needs an ancestor with data-morph-root.')
      return
    }
    const cs = getComputedStyle(el)
    if (cs.position === 'static') el.style.position = 'relative'
    if (cs.isolation !== 'isolate') el.style.isolation = 'isolate'
  }, [])
  return find
}

function useEscape(on: boolean, dismiss: (() => void) | undefined) {
  const latest = useRef(dismiss)
  latest.current = dismiss
  useEffect(() => {
    if (!on) return
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) latest.current?.()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [on])
}

export function Morph(props: MorphProps) {
  return useReducedMotion() ? <ReducedMorph {...props} /> : <LiquidMorph {...props} />
}

function ReducedMorph({ open, panel, radius, place, inset = 8, scrim = 'rgba(0, 0, 0, 0.2)', label, children, onDismiss, onLanded, className, top }: MorphProps) {
  const anchor = useRef<HTMLDivElement>(null)
  const root = useRoot(anchor)
  const [shown, setShown] = useState(open)
  const [on, setOn] = useState(false)
  const wasOpen = useRef(open)
  const landed = useRef(onLanded)
  landed.current = onLanded
  const modal = scrim !== false
  useEscape(open && modal, onDismiss)

  useEffect(() => {
    if (open) {
      wasOpen.current = true
      setShown(true)
      let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setOn(true))))
      return () => cancelAnimationFrame(raf)
    }
    if (!wasOpen.current) return
    wasOpen.current = false
    setOn(false)
    const t = window.setTimeout(() => {
      setShown(false)
      landed.current?.()
    }, FADE_MS)
    return () => clearTimeout(t)
  }, [open])

  const host = shown ? root() : null
  const fade: CSSProperties = { opacity: on ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` }
  return (
    <>
      <div ref={anchor} hidden />
      {host &&
        createPortal(
          <>
            {modal && <div className="m-scrim" style={{ ...scrimStyle(scrim, open), ...fade }} onClick={onDismiss} />}
            <div
              className={`m-panel ${className ?? ''}`}
              role="dialog"
              aria-modal={modal || undefined}
              aria-label={label}
              style={{ position: 'absolute', zIndex: 71, overflow: 'hidden', background: panel, ...resting(inset, radius, top, place), ...fade }}
            >
              {children}
            </div>
          </>,
          host,
        )}
    </>
  )
}

function LiquidMorph(props: MorphProps) {
  const { open, source, panel, radius, place, inset = 8, scrim = 'rgba(0, 0, 0, 0.2)', shadow, drag, label, ghost, children, onDismiss, className, top } = props
  const modal = scrim !== false
  const slow = useContext(MorphSpeed)
  const drops = useMemo(() => parseShadows(shadow), [shadow])
  const live = useRef({ ...props, slow, drops })
  live.current = { ...props, slow, drops }

  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')
  phaseRef.current = phase
  const [rect, setRect] = useState<Rect | null>(null)
  const [here, setHere] = useState<Rect | null>(null)
  const [look, setLook] = useState<Look>(NO_LOOK)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const filterId = `morph-${useId().replace(/[^\w-]/g, '')}`
  const anchor = useRef<HTMLDivElement>(null)
  const root = useRoot(anchor)
  const wrap = useRef<HTMLDivElement>(null)
  const svgEl = useRef<SVGSVGElement>(null)
  const silhouette = useRef<SVGGElement>(null)
  const shape = useRef<SVGRectElement>(null)
  const lens = useRef<SVGEllipseElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const ghostEl = useRef<HTMLElement>(null)
  const ghostBox = useRef<HTMLElement>(null)
  const blurEl = useRef<SVGFEGaussianBlurElement>(null)
  const matrixEl = useRef<SVGFEColorMatrixElement>(null)
  const scrimEl = useRef<HTMLDivElement>(null)
  const geo = useRef<Geo | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEscape(open && modal, onDismiss)
  useIsoLayoutEffect(() => {
    if (document.getElementById('liquid-morph-css')) return
    const sheet = document.createElement('style')
    sheet.id = 'liquid-morph-css'
    sheet.textContent = GHOST_CSS
    document.head.append(sheet)
  }, [])

  const trigger = () => root()?.querySelector<HTMLElement>(`[data-morph-id="${live.current.source}"]`) ?? null

  const animTime = (a: Anim, now: number) => ((now - a.t0) / 1000) * live.current.slow
  const rectNow = (now: number) => rectAt(geo.current!.anim, animTime(geo.current!.anim, now))
  const velocityNow = (now: number) => {
    const a = geo.current!.anim
    const ta = animTime(a, now)
    if (ta >= a.d) return { x: 0, y: 0, w: 0, h: 0 }
    const dt = 0.008
    const p = rectAt(a, ta)
    const b = rectAt(a, Math.max(0, ta - dt))
    const lim = (v: number) => Math.max(-2500, Math.min(2500, v))
    return { x: lim((p.x - b.x) / dt), y: lim((p.y - b.y) / dt), w: lim((p.w - b.w) / dt), h: lim((p.h - b.h) / dt) }
  }
  // A sheet is pinned to the root's bottom and grows upward, so its top leads even
  // when a corner trigger travels further sideways.
  const flight = (from: Required<Rect>, to: Required<Rect>, t0: number, d = 0, vel = STILL, curve = ease): Anim => ({
    from,
    to,
    t0,
    d,
    vel,
    edge: live.current.place ? leadingEdge(from, to) : 'top',
    ease: curve,
  })
  const startAnim = (to: Rect, kind: Flight, now: number) => {
    const g = geo.current!
    const from = rectNow(now)
    const vel = velocityNow(now)
    const k = weight(travel(from, to))
    g.anim = flight(from, req(to, to.r ?? live.current.radius), now, lerp(TIMING[kind][0], TIMING[kind][1], k) / 1000, vel, curveAt(k))
  }
  const settle = (to: Rect, now: number) => {
    const r = req(to, to.r ?? live.current.radius)
    geo.current!.anim = flight(r, r, now)
  }

  const finish = () => {
    const g = geo.current
    if (!g || g.dir !== 'close' || phaseRef.current !== 'closing') return
    setPhase('landed')
    setRect(null)
    setHere(null)
    live.current.onLanded?.()
  }

  const tick = () => {
    const g = geo.current
    const rootNode = root()
    if (!g || !rootNode || phaseRef.current === 'idle') return
    const c = live.current
    const el = surface.current
    const now = performance.now()
    const dt = Math.min(0.1, ((now - g.lastT) / 1000) * c.slow)
    g.lastT = now
    let q = g.dir === 'open' ? 1 : 0

    if (g.dir === 'close' && el) {
      const target = measure(c.source, rootNode)
      if (target) {
        if (!g.target || !sameRect(target, g.target, 0.25)) {
          g.target = target
          g.anim = flight(g.anim.from, req(target, target.r ?? target.h / 2), g.anim.t0, g.anim.d, g.anim.vel, g.anim.ease)
        }
        write(el, 'left', `${target.x}px`)
        write(el, 'top', `${target.y}px`)
        write(el, 'width', `${target.w}px`)
        write(el, 'height', `${target.h}px`)
      }
    }

    const body = shape.current
    const bulge = lens.current
    if (el && body && bulge) {
      const s = local(el, rootNode)
      const sx = s.x
      const sy = s.y
      const box: Rect = { ...s, r: c.radius }

      if (g.dir === 'open' && g.lock) {
        if (!sameSize(box, g.anim.to)) startAnim(box, 'size', now)
        else if (!sameRect(box, g.anim.to, 0.1) && animTime(g.anim, now) >= g.anim.d) settle(box, now)
      }

      const done = animTime(g.anim, now) >= g.anim.d
      const R = rectNow(now)
      const v = velocityNow(now)

      const timed = eased(g.anim, animTime(g.anim, now))
      if (g.dir === 'open') {
        // While opening, g.anim is still the previous flight, so its clock says nothing yet.
        q = progress(g.from, s, R) ?? (phaseRef.current === 'opening' ? 0 : timed)
        if (!g.lock && done && sameRect(R, box, 0.5)) g.lock = true
        if (g.lock) q = 1
      } else q = (g.target && progress(g.target, g.here, R)) ?? 1 - timed

      const goo = ramp(q, 0, GOO_SPAN)
      const edge = EDGE * goo
      attr(blurEl.current, 'stdDeviation', (BLUR * goo).toFixed(2))
      attr(matrixEl.current, 'values', gooMatrix(goo))
      attr(body, 'x', (R.x + edge).toFixed(2))
      attr(body, 'y', (R.y + edge).toFixed(2))
      attr(body, 'width', Math.max(0, R.w - 2 * edge).toFixed(2))
      attr(body, 'height', Math.max(0, R.h - 2 * edge).toFixed(2))
      attr(body, 'rx', Math.max(0, R.r - edge).toFixed(2))

      const want = LENS * (1 - Math.exp(-Math.abs(EDGE_SPEED[g.anim.edge](v)) / 2000))
      g.lensAmp += (want - g.lensAmp) * (1 - Math.exp(-dt / 0.025))
      const L = g.lensAmp * goo > 0.3 ? lensOn(g.anim.edge, R, g.lensAmp * goo) : null
      if (L) {
        attr(bulge, 'cx', L.cx.toFixed(2))
        attr(bulge, 'cy', L.cy.toFixed(2))
        attr(bulge, 'rx', L.rx.toFixed(2))
        attr(bulge, 'ry', L.ry.toFixed(2))
      } else attr(bulge, 'ry', '0')

      const t = R.y - sy
      const l = R.x - sx
      const r = sx + s.w - (R.x + R.w)
      const b = sy + s.h - (R.y + R.h)
      write(el, 'clip-path', `inset(${t.toFixed(1)}px ${r.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${R.r.toFixed(1)}px)`)

      const cw = g.dir === 'close' ? g.here.w : s.w
      const fit = cw > 0 ? R.w / cw : 1
      // The content rides the liquid at the liquid's width, but only shows once it is drawn within
      // 60 to 90% of its real size: nothing grows out of a speck or shrinks out of a blow-up.
      const show = Math.min(ramp(q, 0.3, 0.85), ramp(Math.min(fit, 1 / fit), 0.6, 0.9))
      // Eased in time as well, so a steep flight can't flash the content in or out within a frame or two.
      g.ride = Math.abs(show - g.ride) < 0.005 ? show : g.ride + (show - g.ride) * (1 - Math.exp(-dt / FADE_TAU))
      const ride = g.ride
      write(content.current, 'transform', `translate(${l.toFixed(2)}px, ${t.toFixed(2)}px) scale(${fit.toFixed(4)})`)
      write(content.current, 'opacity', ride.toFixed(3))
      write(content.current, 'filter', ride >= 1 ? 'none' : `blur(${((1 - ride) * CONTENT_BLUR).toFixed(1)}px)`)

      const at = g.dir === 'open' ? g.from : g.target
      if (at) {
        // The look copy sits outside the clipped surface (a ring drawn past the trigger's edge
        // would be clipped off); the label copy rides inside it.
        for (const [gh, ox, oy] of [[ghostBox.current, 0, 0], [ghostEl.current, sx, sy]] as const) {
          write(gh, 'left', `${(at.x - ox).toFixed(1)}px`)
          write(gh, 'top', `${(at.y - oy).toFixed(1)}px`)
          write(gh, 'width', `${at.w.toFixed(1)}px`)
          write(gh, 'height', `${at.h.toFixed(1)}px`)
          write(gh, 'border-radius', `${(at.r ?? at.h / 2).toFixed(1)}px`)
        }
        // The trigger's own look (fill, gradient, border, a ring in ::before) shows only while the
        // liquid fits the trigger, so nothing of it hangs around a liquid that is still bigger.
        const fits = g.dir === 'open' ? 1 - ramp(q, 0.003, 0.01) : 1 - ramp(q, 0.002, 0.01)
        const gone = g.dir === 'open' ? ramp(q, 0, 0.25) : ramp(q, 0.02, 0.4)
        write(ghostBox.current, 'opacity', fits.toFixed(3))
        write(ghostEl.current, 'opacity', (1 - gone).toFixed(3))
        write(ghostEl.current, 'filter', gone <= 0 ? 'none' : `blur(${(gone * LABEL_BLUR).toFixed(1)}px)`)
      }

      write(silhouette.current, 'fill', mix(g.endFill, c.panel, ramp(q, 0.02, 0.4)))
      // Without goo at rest the liquid has the trigger's exact shape and fill, so it stays solid until
      // it is swapped for the trigger. Only a trigger with no fill of its own needs it to fade.
      const bare = g.endFill === c.panel
      write(silhouette.current, 'opacity', !bare ? '1' : (g.dir === 'open' ? ramp(q, 0, 0.003) : ramp(q, 0.003, 0.006)).toFixed(3))

      if (g.dir === 'close') {
        const fits = done && !!g.target && sameRect(R, g.target, 1)
        if (fits || (now - g.t0) * c.slow > LAND_MAX) finish()
      }
    }

    if (g.dir === 'open' || !g.dim) g.bg = q
    else g.bg = g.dim.from * (1 - g.dim.ease(clamp01((((now - g.dim.t0) / 1000) * c.slow) / g.dim.d)))
    write(scrimEl.current, 'opacity', g.bg.toFixed(3))
    write(rootNode, '--morph-q', q.toFixed(3))
    const backs = rootNode.querySelectorAll<HTMLElement>('[data-morph-recede]')
    for (const back of backs) {
      write(back, 'transform-origin', '50% 0%')
      write(back, 'transform', `scale(${(1 - (1 - (c.recede ?? 0.97)) * g.bg).toFixed(4)})`)
    }
    write(svgEl.current, 'filter', shadowAt(c.drops, q))
    const dimDone = !g.dim || ((now - g.dim.t0) / 1000) * c.slow >= g.dim.d
    if (phaseRef.current === 'landed' && dimDone) {
      write(scrimEl.current, 'opacity', '0')
      for (const back of backs) {
        back.style.removeProperty('transform')
        back.style.removeProperty('transform-origin')
        forget(back)
      }
      geo.current = null
      setPhase('idle')
    }
  }
  const tickRef = useRef(tick)
  tickRef.current = tick

  const active = phase !== 'idle'
  const flowing = active && phase !== 'landed'
  useEffect(() => {
    if (!active) return
    let raf = 0
    let fresh = false
    // Styles written inside the panel (an inner animation, a drag) tick the
    // liquid in the same frame instead of one frame behind.
    const mo = new MutationObserver(() => {
      fresh = true
      tickRef.current()
      mo.takeRecords()
    })
    if (surface.current) mo.observe(surface.current, { subtree: true, attributes: true, attributeFilter: ['style'] })
    const loop = () => {
      if (!fresh) {
        tickRef.current()
        mo.takeRecords()
      }
      fresh = false
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
    }
  }, [active])

  useIsoLayoutEffect(() => {
    const el = wrap.current
    if (!flowing || !el) return
    const fit = () => setSize((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [flowing])

  // The trigger hides while the liquid stands in for it, and shows again in
  // the same commit that removes the liquid.
  useIsoLayoutEffect(() => {
    const el = trigger()
    if (el) el.style.visibility = phase === 'idle' || phase === 'landed' ? '' : 'hidden'
  }, [phase])

  // React 18 keeps only inert="" and React 19 reads "" as false, so neither form of the prop works in both.
  useIsoLayoutEffect(() => {
    ghostEl.current?.setAttribute('inert', '')
    ghostBox.current?.setAttribute('inert', '')
  }, [flowing, look.tag])

  useIsoLayoutEffect(() => {
    if (phase !== 'idle') tickRef.current()
  }, [phase, rect, here, look, size])

  useIsoLayoutEffect(() => {
    const now = performance.now()
    const rootNode = root()
    if (open && (phase === 'idle' || phase === 'closing' || phase === 'landed')) {
      timers.current.forEach(clearTimeout)
      timers.current = []
      const el = trigger()
      const from = measure(source, rootNode) ?? { x: 96, y: 600, w: 200, h: 56, r: 28 }
      const prev = geo.current
      const start = req(from, from.r ?? from.h / 2)
      geo.current = {
        dir: 'open',
        from,
        here: from,
        target: null,
        endFill: fillOf(el, panel),
        lock: false,
        anim: prev ? prev.anim : flight(start, start, now),
        dim: null,
        bg: prev?.bg ?? 0,
        lensAmp: prev?.lensAmp ?? 0,
        ride: prev?.ride ?? 0,
        lastT: now,
        t0: now,
      }
      setLook(lookOf(el))
      setRect(null)
      setHere(null)
      setPhase('opening')
      requestAnimationFrame(() => {
        const g = geo.current
        const rn = root()
        if (!g || g.dir !== 'open' || !surface.current || !rn) return
        const box: Rect = { ...local(surface.current, rn), r: live.current.radius }
        startAnim(box, 'open', performance.now())
        setPhase('open')
      })
    }
    if (!open && (phase === 'open' || phase === 'opening')) {
      const box: Rect = surface.current && rootNode ? local(surface.current, rootNode) : { x: inset, y: 400, w: 377, h: 400 }
      const el = trigger()
      const first = measure(source, rootNode)
      const fallback = first ?? { x: box.x + box.w / 2 - 4, y: box.y + 16, w: 8, h: 8 }
      const prev = geo.current
      const g: Geo = {
        dir: 'close',
        from: prev?.from ?? box,
        here: box,
        target: fallback,
        endFill: fillOf(el, panel),
        lock: false,
        anim: prev?.anim ?? flight(req(box, radius), req(box, radius), now),
        dim: null,
        bg: prev?.bg ?? 1,
        lensAmp: prev?.lensAmp ?? 0,
        ride: prev?.ride ?? 1,
        lastT: now,
        t0: now,
      }
      geo.current = g
      startAnim(fallback, 'close', now)
      g.dim = { from: g.bg, t0: now, d: g.anim.d * TAIL, ease: g.anim.ease }
      setLook(lookOf(el))
      setPhase('closing')
      setHere(box)
      setRect(fallback)
      if (!first) timers.current.push(window.setTimeout(finish, 380 / live.current.slow))
    }
  }, [open])

  // Drag to dismiss: the panel follows the finger down with light resistance,
  // barely moves up, and snaps back unless pulled far or flicked.
  const pull = useRef<{ id: number; y0: number; y: number; t: number; v: number; on: boolean } | null>(null)
  const release = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pull.current
    const el = surface.current
    pull.current = null
    if (!p?.on || !el) return
    const v = e.timeStamp - p.t > 100 ? 0 : p.v
    if (e.type === 'pointerup' && (e.clientY - p.y0 > PULL_DISTANCE || v > PULL_VELOCITY)) live.current.onDismiss?.()
    el.style.transition = 'transform 400ms cubic-bezier(0.23, 1, 0.32, 1)'
    el.style.transform = ''
    el.style.userSelect = ''
  }
  const pullHandlers = drag
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (phaseRef.current !== 'open' || e.button !== 0) return
          pull.current = { id: e.pointerId, y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0, on: false }
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
          const p = pull.current
          const el = surface.current
          if (!p || p.id !== e.pointerId || !el) return
          const dy = e.clientY - p.y0
          if (!p.on) {
            if (Math.abs(dy) < PULL_START) return
            p.on = true
            el.setPointerCapture(e.pointerId)
            el.style.transition = ''
            el.style.userSelect = 'none'
            getSelection()?.removeAllRanges()
          }
          const dt = e.timeStamp - p.t
          if (dt > 0) p.v = p.v * 0.6 + ((e.clientY - p.y) / dt) * 1000 * 0.4
          p.y = e.clientY
          p.t = e.timeStamp
          el.style.transform = `translateY(${(dy > 0 ? dy * 0.9 : dy * 0.04).toFixed(1)}px)`
        },
        onPointerUp: release,
        onPointerCancel: release,
      }
    : null

  const closing = phase === 'closing'
  const host = active ? root() : null
  return (
    <>
      <div ref={anchor} hidden />
      {host &&
        createPortal(
          <>
            {modal && <div ref={scrimEl} className="m-scrim" style={{ ...scrimStyle(scrim, phase === 'open'), opacity: 0 }} onClick={onDismiss} />}
            {flowing && (
              <div ref={wrap} className="m-wrap" style={{ ...FILL, zIndex: 71, pointerEvents: 'none', isolation: 'isolate' }}>
                <svg ref={svgEl} aria-hidden focusable="false" style={SVG_STYLE}>
                  <defs>
                    <filter id={filterId} filterUnits="userSpaceOnUse" x={-PAD} y={-PAD} width={size.w + PAD * 2} height={size.h + PAD * 2} colorInterpolationFilters="sRGB">
                      <feGaussianBlur ref={blurEl} in="SourceGraphic" stdDeviation={BLUR} result="blur" />
                      <feColorMatrix ref={matrixEl} in="blur" type="matrix" values={gooMatrix(1)} result="goo" />
                      <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                    </filter>
                  </defs>
                  <g ref={silhouette} filter={`url(#${filterId})`} style={{ fill: panel }}>
                    <rect ref={shape} />
                    <ellipse ref={lens} />
                  </g>
                </svg>
                {createElement(look.tag, {
                  ref: ghostBox,
                  className: `${look.className} m-ghost`,
                  'aria-hidden': true,
                  tabIndex: -1,
                  type: look.tag === 'button' ? 'button' : undefined,
                  style: { ...look.style, ...GHOST_STYLE },
                })}
                <div
                  ref={surface}
                  className={`m-surface ${className ?? ''}`}
                  data-phase={phase}
                  role="dialog"
                  aria-modal={modal || undefined}
                  aria-label={label}
                  style={{ position: 'absolute', pointerEvents: 'auto', overflow: 'visible', touchAction: drag ? 'none' : undefined, ...(rect ? rectStyle(rect, radius) : resting(inset, radius, top, place)) }}
                  {...pullHandlers}
                >
                  <div
                    ref={content}
                    className="m-content"
                    style={{ transformOrigin: '0 0', opacity: 0, willChange: 'transform, opacity, filter', ...(closing && here ? { position: 'absolute', left: 0, top: 0, width: here.w } : null) }}
                  >
                    {children}
                  </div>
                  {createElement(
                    look.tag,
                    {
                      ref: ghostEl,
                      className: `${look.className} m-ghost m-ghost-label`,
                      'aria-hidden': true,
                      tabIndex: -1,
                      type: look.tag === 'button' ? 'button' : undefined,
                      style: { ...look.style, ...GHOST_STYLE, ...LABEL_ONLY },
                    },
                    ghost,
                  )}
                </div>
              </div>
            )}
          </>,
          host,
        )}
    </>
  )
}
