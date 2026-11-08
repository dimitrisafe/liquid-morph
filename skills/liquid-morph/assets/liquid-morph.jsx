// Generated from liquid-morph.tsx with esbuild --jsx=preserve. Edit the .tsx, then regenerate.
"use client";
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
  useSyncExternalStore
} from "react";
import { createPortal } from "react-dom";
const MorphSpeed = createContext(1);
const BLUR = 10;
const CONTRAST = 22;
const PAD = BLUR * 3 + 24;
const gooMatrix = (s) => {
  const c = 1 + (CONTRAST - 1) * s;
  return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${c.toFixed(3)} ${Math.min(0, 0.5 - c * (5 / 12)).toFixed(3)}`;
};
const NEAR = 60;
const FAR = 560;
const TIMING = { open: [190, 340], close: [170, 300], size: [160, 280] };
const FADE_MS = 200;
const CORNER = 24;
const LENS = 14;
const LABEL_BLUR = 8;
const CONTENT_BLUR = 6;
const FADE_TAU = 0.03;
const LAND_MAX = 800;
const CARRY_TAU = 0.03;
const TAIL = 1.35;
const EDGE = BLUR * 0.15;
const GOO_SPAN = 0.15;
const LOOK_SPAN = 0.25;
const LABEL_ONLY = { background: "none", borderColor: "transparent", boxShadow: "none", outline: "none" };
const GHOST_CSS = ".m-ghost-label::before,.m-ghost-label::after{opacity:0!important}";
const PULL_START = 4;
const PULL_DISTANCE = 110;
const PULL_VELOCITY = 600;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ramp = (q, a, b) => clamp01((q - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
function bezier(x1, y1, x2, y2) {
  const at = (a, b, u) => 3 * u * (1 - u) * (1 - u) * a + 3 * u * u * (1 - u) * b + u * u * u;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}
const CURVE_NEAR = [0.45, 0.6, 0.35, 1];
const CURVE_FAR = [0.32, 0.72, 0, 1];
const curveAt = (k) => bezier(...CURVE_NEAR.map((c, i) => lerp(c, CURVE_FAR[i], k)));
const ease = curveAt(0);
const weight = (px) => clamp01((px - NEAR) / (FAR - NEAR));
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
function rgb(c) {
  const hex = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (hex) return [...[0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), 1];
  const fn = /^rgba?\(([^)]*)\)$/.exec(c.trim());
  if (fn) {
    const p = fn[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  return null;
}
const alpha = (c, a) => {
  const C = rgb(c);
  return C ? `rgba(${C[0]}, ${C[1]}, ${C[2]}, ${(a * C[3]).toFixed(3)})` : c;
};
const mix = (a, b, t) => {
  const A = rgb(a);
  const B = rgb(b);
  if (!A || !B) return t < 0.5 ? a : b;
  return `rgb(${[0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t)).join(", ")})`;
};
const fillOf = (el, panel) => {
  const c = el ? getComputedStyle(el).backgroundColor : "";
  const C = rgb(c);
  return C && C[3] > 0.5 ? c : panel;
};
const LENGTH = /^-?[\d.]+(px)?$/;
function parseShadows(css = "") {
  return css.split(/,(?![^(]*\))/).flatMap((part) => {
    const tokens = part.trim().split(/\s+(?![^(]*\))/).filter(Boolean);
    if (tokens.includes("inset")) return [];
    const n = tokens.filter((t) => LENGTH.test(t)).map(parseFloat);
    const c = tokens.find((t) => !LENGTH.test(t)) ?? "rgba(0, 0, 0, 0.25)";
    return n.length >= 2 ? [{ x: n[0], y: n[1], b: n[2] ?? 0, c }] : [];
  });
}
const shadowAt = (drops, q) => drops.map((d) => `drop-shadow(${(d.x * q).toFixed(2)}px ${(d.y * q).toFixed(2)}px ${(d.b * q).toFixed(2)}px ${alpha(d.c, q)})`).join(" ");
const written = /* @__PURE__ */ new WeakMap();
function write(el, prop, value) {
  if (!el) return;
  let cache = written.get(el);
  if (!cache) written.set(el, cache = /* @__PURE__ */ new Map());
  if (cache.get(prop) === value) return;
  cache.set(prop, value);
  el.style.setProperty(prop, value);
}
function attr(el, name, value) {
  if (!el) return;
  let cache = written.get(el);
  if (!cache) written.set(el, cache = /* @__PURE__ */ new Map());
  if (cache.get(name) === value) return;
  cache.set(name, value);
  el.setAttribute(name, value);
}
const forget = (el) => el && written.delete(el);
const sameRect = (a, b, tol = 0.5) => Math.abs(a.x - b.x) < tol && Math.abs(a.y - b.y) < tol && Math.abs(a.w - b.w) < tol && Math.abs(a.h - b.h) < tol;
const sameSize = (a, b, tol = 0.5) => Math.abs(a.w - b.w) < tol && Math.abs(a.h - b.h) < tol;
const travel = (a, b) => Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), Math.abs(b.x + b.w - a.x - a.w), Math.abs(b.y + b.h - a.y - a.h));
function progress(a, b, at) {
  const wide = Math.abs(b.w - a.w) > Math.abs(b.h - a.h);
  const total = wide ? b.w - a.w : b.h - a.h;
  return Math.abs(total) > 1 ? clamp01((wide ? at.w - a.w : at.h - a.h) / total) : null;
}
function leadingEdge(a, b) {
  const moved = [
    ["top", Math.abs(b.y - a.y)],
    ["bottom", Math.abs(b.y + b.h - a.y - a.h)],
    ["left", Math.abs(b.x - a.x)],
    ["right", Math.abs(b.x + b.w - a.x - a.w)]
  ];
  return moved.reduce((best, m) => m[1] > best[1] ? m : best)[0];
}
const STILL = { x: 0, y: 0, w: 0, h: 0 };
const req = (r, fallbackR) => ({ x: r.x, y: r.y, w: r.w, h: r.h, r: r.r ?? fallbackR });
const eased = (a, ta) => a.ease(a.d > 0 ? clamp01(ta / a.d) : 1);
function rectAt(a, ta) {
  const e = eased(a, ta);
  const carry = ta * Math.exp(-ta / CARRY_TAU) * (1 - e);
  const w = lerp(a.from.w, a.to.w, e) + a.vel.w * carry;
  const h = lerp(a.from.h, a.to.h, e) + a.vel.h * carry;
  const r = lerp(a.from.r, a.to.r, e) + CORNER * 4 * e * (1 - e);
  return { x: lerp(a.from.x, a.to.x, e) + a.vel.x * carry, y: lerp(a.from.y, a.to.y, e) + a.vel.y * carry, w, h, r: Math.min(r, w / 2, h / 2) };
}
const EDGE_SPEED = {
  top: (v) => v.y,
  bottom: (v) => v.y + v.h,
  left: (v) => v.x,
  right: (v) => v.x + v.w
};
function lensOn(edge, R, amp) {
  if (edge === "top" || edge === "bottom") {
    if (R.w <= R.r * 2 + 8) return null;
    return { cx: R.x + R.w / 2, cy: edge === "top" ? R.y + EDGE + 2 : R.y + R.h - EDGE - 2, rx: R.w / 2 - R.r - 2, ry: amp + 2 };
  }
  if (R.h <= R.r * 2 + 8) return null;
  return { cx: edge === "left" ? R.x + EDGE + 2 : R.x + R.w - EDGE - 2, cy: R.y + R.h / 2, rx: amp + 2, ry: R.h / 2 - R.r - 2 };
}
function local(el, root) {
  const s = root.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const k = s.width ? root.offsetWidth / s.width : 1;
  return { x: (r.left - s.left) * k, y: (r.top - s.top) * k, w: r.width * k, h: r.height * k };
}
function measure(id, root) {
  const el = root?.querySelector(`[data-morph-id="${id}"]`);
  if (!el || !root) return null;
  const r = local(el, root);
  if (!r.w) return null;
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  return { ...r, r: Math.min(radius, r.h / 2) };
}
const rectStyle = (r, max) => ({ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: Math.min(max, r.r ?? r.h / 2, r.h / 2) });
const FILL = { position: "absolute", inset: 0 };
const SVG_STYLE = { ...FILL, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none", zIndex: -1, willChange: "filter, transform" };
const NO_LOOK = { tag: "div", className: "", style: {} };
const PLACED = /^(position|inset|left|top|right|bottom|width|height|min-|max-|margin|transform|translate|scale|rotate|visibility|opacity|filter|transition|animation|will-change|z-index)|radius$/;
const VOID_TAGS = /* @__PURE__ */ new Set(["area", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
function lookOf(el) {
  if (!el) return NO_LOOK;
  const style = {};
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style[i];
    if (!PLACED.test(name)) style[name.startsWith("--") ? name : name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = el.style.getPropertyValue(name);
  }
  const tag = el.tagName.toLowerCase();
  return { tag: VOID_TAGS.has(tag) ? "div" : tag, className: el.getAttribute("class") ?? "", style };
}
const GHOST_STYLE = {
  position: "absolute",
  right: "auto",
  bottom: "auto",
  margin: 0,
  transform: "none",
  translate: "none",
  scale: "none",
  rotate: "none",
  visibility: "visible",
  pointerEvents: "none",
  transition: "none",
  opacity: 0,
  // A trigger's own z-index would lift the look copy over the label copy.
  zIndex: "auto"
};
const scrimStyle = (background, interactive) => ({ ...FILL, zIndex: 70, borderRadius: "inherit", background, pointerEvents: interactive ? "auto" : "none" });
const resting = (inset, radius, top, place) => place ? { ...place, borderRadius: radius } : {
  left: inset,
  right: inset,
  bottom: inset,
  borderRadius: radius,
  maxHeight: top !== void 0 ? `calc(100% - ${top + inset}px)` : void 0
};
const REDUCED = "(prefers-reduced-motion: reduce)";
const onReducedChange = (cb) => {
  const m = matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useReducedMotion = () => useSyncExternalStore(onReducedChange, () => matchMedia(REDUCED).matches, () => false);
function useRoot(anchor) {
  const root = useRef(null);
  const find = () => root.current ?? (root.current = anchor.current?.closest("[data-morph-root]") ?? null);
  useIsoLayoutEffect(() => {
    const el = find();
    if (!el) {
      console.warn("<Morph> needs an ancestor with data-morph-root.");
      return;
    }
    const cs = getComputedStyle(el);
    if (cs.position === "static") el.style.position = "relative";
    if (cs.isolation !== "isolate") el.style.isolation = "isolate";
  }, []);
  return find;
}
function useEscape(on, dismiss) {
  const latest = useRef(dismiss);
  latest.current = dismiss;
  useEffect(() => {
    if (!on) return;
    const key = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) latest.current?.();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [on]);
}
function Morph(props) {
  return useReducedMotion() ? <ReducedMorph {...props} /> : <LiquidMorph {...props} />;
}
function ReducedMorph({ open, panel, radius, place, inset = 8, scrim = "rgba(0, 0, 0, 0.2)", label, children, onDismiss, onLanded, className, top }) {
  const anchor = useRef(null);
  const root = useRoot(anchor);
  const [shown, setShown] = useState(open);
  const [on, setOn] = useState(false);
  const wasOpen = useRef(open);
  const landed = useRef(onLanded);
  landed.current = onLanded;
  const modal = scrim !== false;
  useEscape(open && modal, onDismiss);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      setShown(true);
      let raf = requestAnimationFrame(() => raf = requestAnimationFrame(() => setOn(true)));
      return () => cancelAnimationFrame(raf);
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    setOn(false);
    const t = window.setTimeout(() => {
      setShown(false);
      landed.current?.();
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [open]);
  const host = shown ? root() : null;
  const fade = { opacity: on ? 1 : 0, transition: `opacity ${FADE_MS}ms ease` };
  return <>
      <div ref={anchor} hidden />
      {host && createPortal(
    <>
            {modal && <div className="m-scrim" style={{ ...scrimStyle(scrim, open), ...fade }} onClick={onDismiss} />}
            <div
      className={`m-panel ${className ?? ""}`}
      role="dialog"
      aria-modal={modal || void 0}
      aria-label={label}
      style={{ position: "absolute", zIndex: 71, overflow: "hidden", background: panel, ...resting(inset, radius, top, place), ...fade }}
    >
              {children}
            </div>
          </>,
    host
  )}
    </>;
}
function LiquidMorph(props) {
  const { open, source, panel, radius, place, inset = 8, scrim = "rgba(0, 0, 0, 0.2)", shadow, drag, label, ghost, children, onDismiss, className, top } = props;
  const modal = scrim !== false;
  const slow = useContext(MorphSpeed);
  const drops = useMemo(() => parseShadows(shadow), [shadow]);
  const live = useRef({ ...props, slow, drops });
  live.current = { ...props, slow, drops };
  const [phase, setPhase] = useState("idle");
  const phaseRef = useRef("idle");
  phaseRef.current = phase;
  const [rect, setRect] = useState(null);
  const [here, setHere] = useState(null);
  const [inner, setInner] = useState(null);
  const [look, setLook] = useState(NO_LOOK);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const filterId = `morph-${useId().replace(/[^\w-]/g, "")}`;
  const anchor = useRef(null);
  const root = useRoot(anchor);
  const wrap = useRef(null);
  const svgEl = useRef(null);
  const silhouette = useRef(null);
  const shape = useRef(null);
  const lens = useRef(null);
  const surface = useRef(null);
  const content = useRef(null);
  const ghostEl = useRef(null);
  const ghostBox = useRef(null);
  const blurEl = useRef(null);
  const matrixEl = useRef(null);
  const scrimEl = useRef(null);
  const geo = useRef(null);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEscape(open && modal, onDismiss);
  useIsoLayoutEffect(() => {
    if (document.getElementById("liquid-morph-css")) return;
    const sheet = document.createElement("style");
    sheet.id = "liquid-morph-css";
    sheet.textContent = GHOST_CSS;
    document.head.append(sheet);
  }, []);
  const trigger = () => root()?.querySelector(`[data-morph-id="${live.current.source}"]`) ?? null;
  const animTime = (a, now) => (now - a.t0) / 1e3 * live.current.slow;
  const rectNow = (now) => rectAt(geo.current.anim, animTime(geo.current.anim, now));
  const velocityNow = (now) => {
    const a = geo.current.anim;
    const ta = animTime(a, now);
    if (ta >= a.d) return { x: 0, y: 0, w: 0, h: 0 };
    const dt = 8e-3;
    const p = rectAt(a, ta);
    const b = rectAt(a, Math.max(0, ta - dt));
    const lim = (v) => Math.max(-2500, Math.min(2500, v));
    return { x: lim((p.x - b.x) / dt), y: lim((p.y - b.y) / dt), w: lim((p.w - b.w) / dt), h: lim((p.h - b.h) / dt) };
  };
  const flight = (from, to, t0, d = 0, vel = STILL, curve = ease) => ({
    from,
    to,
    t0,
    d,
    vel,
    edge: live.current.place ? leadingEdge(from, to) : "top",
    ease: curve
  });
  const startAnim = (to, kind, now) => {
    const g = geo.current;
    const from = rectNow(now);
    const vel = velocityNow(now);
    const k = weight(travel(from, to));
    g.anim = flight(from, req(to, to.r ?? live.current.radius), now, lerp(TIMING[kind][0], TIMING[kind][1], k) / 1e3, vel, curveAt(k));
  };
  const settle = (to, now) => {
    const r = req(to, to.r ?? live.current.radius);
    geo.current.anim = flight(r, r, now);
  };
  const finish = () => {
    const g = geo.current;
    if (!g || g.dir !== "close" || phaseRef.current !== "closing") return;
    setPhase("landed");
    setRect(null);
    setHere(null);
    setInner(null);
    live.current.onLanded?.();
  };
  const tick = () => {
    const g = geo.current;
    const rootNode = root();
    if (!g || !rootNode || phaseRef.current === "idle") return;
    const c = live.current;
    const el = surface.current;
    const now = performance.now();
    const dt = Math.min(0.1, (now - g.lastT) / 1e3 * c.slow);
    g.lastT = now;
    let q = g.dir === "open" ? 1 : 0;
    if (g.dir === "close" && el) {
      const target = measure(c.source, rootNode);
      if (target) {
        if (!g.target || !sameRect(target, g.target, 0.25)) {
          g.target = target;
          g.anim = flight(g.anim.from, req(target, target.r ?? target.h / 2), g.anim.t0, g.anim.d, g.anim.vel, g.anim.ease);
        }
        write(el, "left", `${target.x}px`);
        write(el, "top", `${target.y}px`);
        write(el, "width", `${target.w}px`);
        write(el, "height", `${target.h}px`);
      }
    }
    const body = shape.current;
    const bulge = lens.current;
    if (el && body && bulge) {
      const s = local(el, rootNode);
      const sx = s.x;
      const sy = s.y;
      const box = { ...s, r: c.radius };
      if (g.dir === "open" && g.lock) {
        if (!sameSize(box, g.anim.to)) startAnim(box, "size", now);
        else if (!sameRect(box, g.anim.to, 0.1) && animTime(g.anim, now) >= g.anim.d) settle(box, now);
      }
      const done = animTime(g.anim, now) >= g.anim.d;
      const R = rectNow(now);
      const v = velocityNow(now);
      const timed = eased(g.anim, animTime(g.anim, now));
      if (g.dir === "open") {
        q = progress(g.from, s, R) ?? (phaseRef.current === "opening" ? 0 : timed);
        if (!g.lock && done && sameRect(R, box, 0.5)) g.lock = true;
        if (g.lock) q = 1;
      } else q = (g.target && progress(g.target, g.here, R)) ?? 1 - timed;
      const goo = ramp(q, 0, GOO_SPAN);
      const lookIn = g.dir === "open" ? 1 - ramp(q, 3e-3, LOOK_SPAN) : 1 - ramp(q, 2e-3, LOOK_SPAN);
      const edge = EDGE * goo;
      attr(blurEl.current, "stdDeviation", (BLUR * goo).toFixed(2));
      attr(matrixEl.current, "values", gooMatrix(goo));
      attr(body, "x", (R.x + edge).toFixed(2));
      attr(body, "y", (R.y + edge).toFixed(2));
      attr(body, "width", Math.max(0, R.w - 2 * edge).toFixed(2));
      attr(body, "height", Math.max(0, R.h - 2 * edge).toFixed(2));
      attr(body, "rx", Math.max(0, R.r - edge).toFixed(2));
      const want = LENS * (1 - Math.exp(-Math.abs(EDGE_SPEED[g.anim.edge](v)) / 2e3));
      g.lensAmp += (want - g.lensAmp) * (1 - Math.exp(-dt / 0.025));
      const amp = g.lensAmp * goo * (1 - lookIn);
      const L = amp > 0.3 ? lensOn(g.anim.edge, R, amp) : null;
      if (L) {
        attr(bulge, "cx", L.cx.toFixed(2));
        attr(bulge, "cy", L.cy.toFixed(2));
        attr(bulge, "rx", L.rx.toFixed(2));
        attr(bulge, "ry", L.ry.toFixed(2));
      } else attr(bulge, "ry", "0");
      const t = R.y - sy;
      const l = R.x - sx;
      const r = sx + s.w - (R.x + R.w);
      const b = sy + s.h - (R.y + R.h);
      write(el, "clip-path", `inset(${t.toFixed(1)}px ${r.toFixed(1)}px ${b.toFixed(1)}px ${l.toFixed(1)}px round ${R.r.toFixed(1)}px)`);
      const rest = g.dir === "close" ? g.here : s;
      const fit = rest.w > 0 ? R.w / rest.w : 1;
      const show = Math.min(ramp(q, 0.3, 0.85), ramp(Math.min(fit, 1 / fit), 0.6, 0.9));
      g.ride = Math.abs(show - g.ride) < 5e-3 ? show : g.ride + (show - g.ride) * (1 - Math.exp(-dt / FADE_TAU));
      const ride = g.ride;
      const ix = content.current?.offsetLeft ?? 0;
      const iy = content.current?.offsetTop ?? 0;
      const slack = Math.max(0, (R.h - rest.h * fit) / 2);
      const cx = l + ix * (fit - 1);
      const cy = t + iy * (fit - 1) + slack;
      write(content.current, "transform", `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px) scale(${fit.toFixed(4)})`);
      write(content.current, "opacity", ride.toFixed(3));
      write(content.current, "filter", ride >= 1 ? "none" : `blur(${((1 - ride) * CONTENT_BLUR).toFixed(1)}px)`);
      const at = g.dir === "open" ? g.from : g.target;
      if (at) {
        for (const [gh, box2, ox, oy] of [[ghostBox.current, R, 0, 0], [ghostEl.current, at, sx, sy]]) {
          write(gh, "left", `${(box2.x - ox).toFixed(1)}px`);
          write(gh, "top", `${(box2.y - oy).toFixed(1)}px`);
          write(gh, "width", `${box2.w.toFixed(1)}px`);
          write(gh, "height", `${box2.h.toFixed(1)}px`);
          write(gh, "border-radius", `${(box2.r ?? box2.h / 2).toFixed(1)}px`);
        }
        const gone = g.dir === "open" ? ramp(q, 0, 0.25) : ramp(q, 0.02, 0.4);
        write(ghostBox.current, "opacity", lookIn.toFixed(3));
        write(ghostEl.current, "opacity", (1 - gone).toFixed(3));
        write(ghostEl.current, "filter", gone <= 0 ? "none" : `blur(${(gone * LABEL_BLUR).toFixed(1)}px)`);
      }
      write(silhouette.current, "fill", mix(g.endFill, c.panel, ramp(q, 0.02, 0.4)));
      const bare = g.endFill === c.panel;
      write(silhouette.current, "opacity", !bare ? "1" : (g.dir === "open" ? ramp(q, 0, 3e-3) : ramp(q, 3e-3, 6e-3)).toFixed(3));
      if (g.dir === "close") {
        const fits = done && !!g.target && sameRect(R, g.target, 1);
        if (fits || (now - g.t0) * c.slow > LAND_MAX) finish();
      }
    }
    if (g.dir === "open" || !g.dim) g.bg = q;
    else g.bg = g.dim.from * (1 - g.dim.ease(clamp01((now - g.dim.t0) / 1e3 * c.slow / g.dim.d)));
    write(scrimEl.current, "opacity", g.bg.toFixed(3));
    write(rootNode, "--morph-q", q.toFixed(3));
    const backs = rootNode.querySelectorAll("[data-morph-recede]");
    for (const back of backs) {
      write(back, "transform-origin", "50% 0%");
      write(back, "transform", `scale(${(1 - (1 - (c.recede ?? 0.97)) * g.bg).toFixed(4)})`);
    }
    write(svgEl.current, "filter", shadowAt(c.drops, q));
    const dimDone = !g.dim || (now - g.dim.t0) / 1e3 * c.slow >= g.dim.d;
    if (phaseRef.current === "landed" && dimDone) {
      write(scrimEl.current, "opacity", "0");
      for (const back of backs) {
        back.style.removeProperty("transform");
        back.style.removeProperty("transform-origin");
        forget(back);
      }
      geo.current = null;
      setPhase("idle");
    }
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;
  const active = phase !== "idle";
  const flowing = active && phase !== "landed";
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let fresh = false;
    const mo = new MutationObserver(() => {
      fresh = true;
      tickRef.current();
      mo.takeRecords();
    });
    if (surface.current) mo.observe(surface.current, { subtree: true, attributes: true, attributeFilter: ["style"] });
    const loop = () => {
      if (!fresh) {
        tickRef.current();
        mo.takeRecords();
      }
      fresh = false;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
    };
  }, [active]);
  useIsoLayoutEffect(() => {
    const el = wrap.current;
    if (!flowing || !el) return;
    const fit = () => setSize((s) => s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight });
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [flowing]);
  useIsoLayoutEffect(() => {
    const el = trigger();
    if (el) el.style.visibility = phase === "idle" || phase === "landed" ? "" : "hidden";
  }, [phase]);
  useIsoLayoutEffect(() => {
    ghostEl.current?.setAttribute("inert", "");
    ghostBox.current?.setAttribute("inert", "");
  }, [flowing, look.tag]);
  useIsoLayoutEffect(() => {
    if (phase !== "idle") tickRef.current();
  }, [phase, rect, here, look, size]);
  useIsoLayoutEffect(() => {
    const now = performance.now();
    const rootNode = root();
    if (open && (phase === "idle" || phase === "closing" || phase === "landed")) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      const el = trigger();
      const from = measure(source, rootNode) ?? { x: 96, y: 600, w: 200, h: 56, r: 28 };
      const prev = geo.current;
      const start = req(from, from.r ?? from.h / 2);
      geo.current = {
        dir: "open",
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
        t0: now
      };
      setLook(lookOf(el));
      setRect(null);
      setHere(null);
      setInner(null);
      setPhase("opening");
      requestAnimationFrame(() => {
        const g = geo.current;
        const rn = root();
        if (!g || g.dir !== "open" || !surface.current || !rn) return;
        const box = { ...local(surface.current, rn), r: live.current.radius };
        startAnim(box, "open", performance.now());
        setPhase("open");
      });
    }
    if (!open && (phase === "open" || phase === "opening")) {
      const box = surface.current && rootNode ? local(surface.current, rootNode) : { x: inset, y: 400, w: 377, h: 400 };
      const el = trigger();
      const first = measure(source, rootNode);
      const fallback = first ?? { x: box.x + box.w / 2 - 4, y: box.y + 16, w: 8, h: 8 };
      const prev = geo.current;
      const g = {
        dir: "close",
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
        t0: now
      };
      geo.current = g;
      const node = content.current;
      setInner(node ? { x: node.offsetLeft, y: node.offsetTop, w: node.offsetWidth, h: node.offsetHeight } : null);
      startAnim(fallback, "close", now);
      g.dim = { from: g.bg, t0: now, d: g.anim.d * TAIL, ease: g.anim.ease };
      setLook(lookOf(el));
      setPhase("closing");
      setHere(box);
      setRect(fallback);
      if (!first) timers.current.push(window.setTimeout(finish, 380 / live.current.slow));
    }
  }, [open]);
  const pull = useRef(null);
  const release = (e) => {
    const p = pull.current;
    const el = surface.current;
    pull.current = null;
    if (!p?.on || !el) return;
    const v = e.timeStamp - p.t > 100 ? 0 : p.v;
    if (e.type === "pointerup" && (e.clientY - p.y0 > PULL_DISTANCE || v > PULL_VELOCITY)) live.current.onDismiss?.();
    el.style.transition = "transform 400ms cubic-bezier(0.23, 1, 0.32, 1)";
    el.style.transform = "";
    el.style.userSelect = "";
  };
  const pullHandlers = drag ? {
    onPointerDown: (e) => {
      if (phaseRef.current !== "open" || e.button !== 0) return;
      pull.current = { id: e.pointerId, y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0, on: false };
    },
    onPointerMove: (e) => {
      const p = pull.current;
      const el = surface.current;
      if (!p || p.id !== e.pointerId || !el) return;
      const dy = e.clientY - p.y0;
      if (!p.on) {
        if (Math.abs(dy) < PULL_START) return;
        p.on = true;
        el.setPointerCapture(e.pointerId);
        el.style.transition = "";
        el.style.userSelect = "none";
        getSelection()?.removeAllRanges();
      }
      const dt = e.timeStamp - p.t;
      if (dt > 0) p.v = p.v * 0.6 + (e.clientY - p.y) / dt * 1e3 * 0.4;
      p.y = e.clientY;
      p.t = e.timeStamp;
      el.style.transform = `translateY(${(dy > 0 ? dy * 0.9 : dy * 0.04).toFixed(1)}px)`;
    },
    onPointerUp: release,
    onPointerCancel: release
  } : null;
  const closing = phase === "closing";
  const host = active ? root() : null;
  return <>
      <div ref={anchor} hidden />
      {host && createPortal(
    <>
            {modal && <div ref={scrimEl} className="m-scrim" style={{ ...scrimStyle(scrim, phase === "open"), opacity: 0 }} onClick={onDismiss} />}
            {flowing && <div ref={wrap} className="m-wrap" style={{ ...FILL, zIndex: 71, pointerEvents: "none", isolation: "isolate" }}>
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
      "aria-hidden": true,
      tabIndex: -1,
      type: look.tag === "button" ? "button" : void 0,
      style: { ...look.style, ...GHOST_STYLE }
    })}
                <div
      ref={surface}
      className={`m-surface ${className ?? ""}`}
      data-phase={phase}
      role="dialog"
      aria-modal={modal || void 0}
      aria-label={label}
      style={{ position: "absolute", pointerEvents: "auto", overflow: "visible", touchAction: drag ? "none" : void 0, ...rect ? rectStyle(rect, radius) : resting(inset, radius, top, place) }}
      {...pullHandlers}
    >
                  <div
      ref={content}
      className="m-content"
      style={{ transformOrigin: "0 0", opacity: 0, willChange: "transform, opacity, filter", ...closing && inner ? { position: "absolute", left: inner.x, top: inner.y, width: inner.w, height: inner.h } : null }}
    >
                    {children}
                  </div>
                  {createElement(
      look.tag,
      {
        ref: ghostEl,
        className: `${look.className} m-ghost m-ghost-label`,
        "aria-hidden": true,
        tabIndex: -1,
        type: look.tag === "button" ? "button" : void 0,
        style: { ...look.style, ...GHOST_STYLE, ...LABEL_ONLY }
      },
      ghost
    )}
                </div>
              </div>}
          </>,
    host
  )}
    </>;
}
export {
  Morph,
  MorphSpeed
};
