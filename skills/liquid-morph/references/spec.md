# Liquid morph spec

The platform-neutral definition of the engine. The React engine (`assets/liquid-morph.tsx`) and the SwiftUI engine (`assets/swiftui/LiquidMorph.swift`) both implement it. To port it to another toolkit, implement this file, then follow the toolkit's guide for the parts that differ (drawing the goo, the frame clock, measuring frames).

All lengths are in the root's own points or CSS px. All times are in seconds unless a name ends in `_MS`.

## Contents

1. Model
2. Constants
3. Helpers
4. Flights
5. Lifecycle
6. One frame
7. Drawing the goo
8. Reduced motion
9. Porting checklist

## 1. Model

- **Root.** The container the morph lives in. It defines the coordinate space, holds the trigger and the panel's resting place, and draws every layer above its content.
- **Trigger.** Its rect in root space, its corner radius (capped at half its height), its fill colour, its look (fill, gradient, border, rings) and its label (text or icon). It stays in place, hidden, while the morph is open.
- **Panel.** Its resting rect in root space (from a placement, with the height taken from the content when the placement doesn't fix it), its corner radius, its fill colour and its content.
- **Rect.** `{ x, y, w, h, r }`, where `r` is the corner radius.
- **Phase.** `idle → opening → open → closing → landed → idle`. `opening` lasts until the panel's resting rect is known (one frame). `landed` is the short tail after the liquid is gone, while the scrim finishes fading.

## 2. Constants

| Name | Value | Meaning |
| --- | --- | --- |
| `BLUR` | 10 | Goo blur, as a Gaussian standard deviation |
| `CONTRAST` | 22 | Goo alpha contrast |
| `EDGE` | `BLUR × 0.15` = 1.5 | Inset of the drawn shape, so the thresholded goo matches the rect |
| `GOO_SPAN` | 0.15 | Openness over which the goo fades in (open) and out (close) |
| `NEAR`, `FAR` | 60, 560 | Travel of a short hop and of a long pour |
| `TIMING.open` | 190 → 340 ms | Flight time at `NEAR` → at `FAR` |
| `TIMING.close` | 170 → 300 ms | |
| `TIMING.size` | 160 → 280 ms | A content resize while open |
| `CURVE_NEAR` | `(0.45, 0.6, 0.35, 1)` | Cubic bezier for short hops |
| `CURVE_FAR` | `(0.32, 0.72, 0, 1)` | Cubic bezier for long pours |
| `CORNER` | 24 | Corner swell at mid-flight |
| `LENS` | 14 | Largest bulge on the leading edge |
| `CARRY_TAU` | 0.03 | How fast carried velocity dies out after a reversal |
| `LENS_TAU` | 0.025 | Smoothing of the bulge |
| `FADE_TAU` | 0.03 | Smoothing of the content fade |
| `CONTENT_BLUR` | 6 | Content blur when invisible |
| `LABEL_BLUR` | 8 | Trigger label blur when gone |
| `TAIL` | 1.35 | Scrim fade-out length, × the close flight |
| `LAND_MAX` | 800 ms | Longest a close may take before it lands anyway |
| `FADE_MS` | 200 ms | Reduced-motion crossfade |
| `recede` | 0.97 by default | Scale of receding page content at full openness |

## 3. Helpers

```
clamp01(v)        = min(1, max(0, v))
ramp(q, a, b)     = clamp01((q - a) / (b - a))
lerp(a, b, t)     = a + (b - a) × t
bezier(x1,y1,x2,y2)(t)  standard CSS cubic-bezier: solve x(u) = t by bisection (24 steps), return y(u)

travel(a, b)      = max(|b.x - a.x|, |b.y - a.y|, |b.right - a.right|, |b.bottom - a.bottom|)
weight(px)        = clamp01((px - NEAR) / (FAR - NEAR))          0 = short hop, 1 = long pour
curveAt(k)        = bezier(lerp(CURVE_NEAR, CURVE_FAR, k))         control points blended one by one

progress(a, b, at)                 how far `at` has come from a to b
  use width if |b.w - a.w| > |b.h - a.h|, else height
  total = b.dim - a.dim
  return |total| > 1 ? clamp01((at.dim - a.dim) / total) : none

leadingEdge(a, b)                  the edge that travels furthest; ties go top, bottom, left, right
```

## 4. Flights

A flight moves the liquid's rect from one rect to another.

```
Flight { from, to, t0, d, vel, edge, ease }

rectAt(f, t):                      t = seconds since f.t0, already × the speed multiplier
  e     = f.ease(f.d > 0 ? clamp01(t / f.d) : 1)
  carry = t × exp(-t / CARRY_TAU) × (1 - e)
  x = lerp(f.from.x, f.to.x, e) + f.vel.x × carry          same for y, w, h
  r = lerp(f.from.r, f.to.r, e) + CORNER × 4 × e × (1 - e)
  return { x, y, w, h, r: min(r, w/2, h/2) }

velocityAt(f, t):                  zero once t ≥ f.d
  finite difference of rectAt over 8 ms, each component clamped to ±2500 /s

startFlight(kind, to, now):        kind is open, close or size
  from = rectAt(current flight, now)
  vel  = velocityAt(current flight, now)
  k    = weight(travel(from, to))
  d    = lerp(TIMING[kind].near, TIMING[kind].far, k)
  current flight = { from, to, t0: now, d, vel, edge, ease: curveAt(k) }
  edge = leadingEdge(from, to), except a bottom sheet, whose top edge always leads

settle(to, now):                   current flight = { from: to, to: to, d: 0 }
```

Starting a flight from the current flight's position and velocity is what makes reversals smooth: closing while still opening pours back from where the liquid is, with no jump.

## 5. Lifecycle

**Open** (the controlled `open` value becomes true while idle, closing or landed):

1. Record `from` = the trigger's rect now, and the trigger's fill colour (the panel colour if it has no opaque fill).
2. Keep the current flight if one is running (a reversal), else a still flight at `from`.
3. Hide the trigger. Mount the panel at its resting place, invisible. Phase `opening`.
4. On the next frame, when the panel's resting rect is known: `startFlight(open, rest)`. Phase `open`.
5. While open: once the flight is done and the liquid matches the resting rect within 0.5, set `lock`. While locked, if the content changes the panel's size, `startFlight(size, newRest)`. If only its position changes, `settle`.

**Close** (`open` becomes false while opening or open):

1. Record `here` = the panel's rect now, and `target` = the trigger's rect now. If the trigger can't be measured, land on an 8 × 8 dot at the panel's top centre, and land on a timer after 380 ms.
2. `startFlight(close, target)`. Start the scrim tail: `dim = { from: current scrim, t0: now, d: flight.d × TAIL, ease: flight.ease }`. Phase `closing`.
3. Every frame, measure the trigger again. If it moved by more than 0.25, retarget: keep the flight's `from`, `t0`, `d`, `vel` and `ease`, and change only `to`.
4. **Land** when the flight is done and the liquid is within 1 of `target`, or when the close has taken longer than `LAND_MAX`. In the same frame: remove the liquid and the panel, show the trigger, and fire `onLanded`. Phase `landed`.
5. When the scrim tail finishes, reset the receding content. Phase `idle`.

Apply the results of a panel action on landing (`onLanded`), so the page changes where the eye lands. The exception is a trigger that shows the chosen value (a status pill, a "Booked 10:30" button): change it before closing, so the liquid pours back carrying the new label.

## 6. One frame

Run this on every display frame while the phase is not `idle`. `now` is the frame time × the speed multiplier. `dt` is the time since the previous frame, capped at 0.1.

```
R    = rectAt(flight, now)
v    = velocityAt(flight, now)
done = now - flight.t0 ≥ flight.d

openness q:
  opening   0
  open      locked ? 1 : progress(from, rest, R) ?? eased time
  closing   progress(target, here, R) ?? 1 - eased time

goo     = ramp(q, 0, GOO_SPAN)
edge    = EDGE × goo
blur σ  = BLUR × goo
alpha'  = c × alpha + min(0, 0.5 - c × 5/12),  where c = 1 + (CONTRAST - 1) × goo

liquid body   rounded rect R, inset by `edge` on every side, corner radius R.r - edge
bulge         target = LENS × (1 - exp(-|speed of the leading edge| / 2000))
              amp   += (target - amp) × (1 - exp(-dt / LENS_TAU))
              draw only if amp × goo > 0.3, and only if the leading edge is longer than 2 × R.r + 8:
              an ellipse centred on that edge, inset by edge + 2,
              with half-length (edge length / 2 - R.r - 2) and half-thickness (amp × goo + 2)
liquid fill   mix(trigger fill, panel fill, ramp(q, 0.02, 0.4))          mixed in sRGB
liquid alpha  1. Only a trigger with no fill of its own fades it: ramp(q, 0, 0.003) opening,
              ramp(q, 0.003, 0.006) closing
shadow        the panel's shadow with offset, blur and opacity × q, drawn under the goo shape

panel clip    everything inside the panel is clipped to R (rounded, R.r)
content       restW = rest.w (opening) or here.w (closing)
              fit   = R.w / restW
              draw the content laid out at restW, scaled by `fit` from its top-left corner,
              with that corner at (R.x, R.y)
              show  = min(ramp(q, 0.3, 0.85), ramp(min(fit, 1/fit), 0.6, 0.9))
              ride += (show - ride) × (1 - exp(-dt / FADE_TAU)), snapped when within 0.005
              opacity ride, blur (1 - ride) × CONTENT_BLUR

trigger label at the trigger's rect, inside the panel clip, above the content
              gone = ramp(q, 0, 0.25) opening, ramp(q, 0.02, 0.4) closing
              opacity 1 - gone, blur gone × LABEL_BLUR
trigger look  at the trigger's rect, not clipped (rings can sit outside it), under the label
              fits = 1 - ramp(q, 0.003, 0.01) opening, 1 - ramp(q, 0.002, 0.01) closing
              opacity fits

scrim         opacity q while opening or open; on close, dim.from × (1 - dim.ease(t / dim.d))
recede        receding content scales to 1 - (1 - recede) × scrim, from its top centre
```

The look and the label are two copies of the trigger. The label copy has the trigger's content and none of its fill, border, shadow or decorations. The look copy has the trigger's appearance and no content.

Where a toolkit can't copy a view (SwiftUI, Compose), use the real trigger, which sits under the liquid:

```
closing   trigger opacity = 1 - ramp(q, 0.004, 0.014)      fully in before the liquid starts to fade
          liquid opacity  = ramp(q, 0, 0.004)              then the liquid fades off it
opening   trigger opacity = 1 - ramp(q, 0.003, 0.01)
          liquid opacity  = ramp(q, 0, 0.004)
```

Don't crossfade the two over the same frames: two half-transparent copies of a dark button over a light page add up to a lighter, see-through frame.

## 7. Drawing the goo

The goo is a blur followed by an alpha threshold, applied to the liquid body and the bulge together, then composited "atop" the sharp source so colours stay crisp. Every toolkit has a version of it:

| Toolkit | Blur | Threshold |
| --- | --- | --- |
| Web (SVG filter) | `feGaussianBlur` | `feColorMatrix` alpha row, `feComposite atop` |
| SwiftUI | `GraphicsContext.Filter.blur(radius:)` | `.alphaThreshold(min: 0.5, color: fill)`, then `.blur(radius: 0.5)` |
| Compose, Android 12+ | `RenderEffect.createBlurEffect` | `RenderEffect.createColorFilterEffect(ColorMatrixColorFilter)` |
| Compose, Android 13+ | AGSL `RuntimeShader` (blur and threshold in one pass) | |
| Compose Multiplatform | `BlurEffect` | Skia colour-matrix image filter, or a runtime shader |
| Flutter | `ImageFiltered(ImageFilter.blur)` | `ColorFiltered(ColorFilter.matrix)` |

Where the toolkit has no filters (older Android), skip the goo: draw the rounded rect and the bulge directly. The corner swell, the bulge and the timing still read as liquid.

At rest (`goo = 0`) skip the filter entirely, so the liquid lands as the trigger's exact shape and corner radius.

Two traps:

- **The colour matrix must clamp alpha to 0–1.** SVG and Android clamp; SwiftUI's `.colorMatrix` doesn't, and a 22× contrast then turns dark fills light. Where it doesn't clamp, use the toolkit's threshold filter at 0.5 in the fill colour (SwiftUI `.alphaThreshold(min: 0.5, color:)`), followed by a 0.5-point blur to soften its hard edge. A 0.5 threshold keeps a blurred edge in place, so `EDGE` becomes 0.
- **Filters can stall on first use** while the GPU builds them, which eats the whole first open. Run the filter chain once when the root appears, on a shape too faint to survive the threshold.

## 8. Reduced motion

When the system asks for reduced motion, replace the morph with a `FADE_MS` crossfade: the panel and scrim fade in at their resting place, the trigger stays visible, and `onLanded` fires when the fade-out ends.

## 9. Porting checklist

- [ ] One frame clock drives everything (display link, `TimelineView`, `withFrameNanos`, `Ticker`), with a speed multiplier for slow-motion checks.
- [ ] Rects are measured in the root's own space, so a scaled or offset root still lines up.
- [ ] The trigger is hidden from the open until the landing frame, and shown in the same frame the liquid is removed.
- [ ] Closing while opening reverses from the current position and velocity.
- [ ] The goo fades to nothing at rest: a 12-point corner lands as 12 points, not as a circle.
- [ ] Rings or outlines around the trigger come back only over the last frames of the close, and the landing never flashes lighter.
- [ ] The first open after launch is as smooth as the second (filters warmed up).
- [ ] Content never shows drawn below 60% of its size, and never flashes in or out within a frame or two.
- [ ] Reduced motion gives a 200 ms crossfade.
- [ ] Check it in slow motion (speed 0.1 to 0.25): an open, a close, and a close while still opening.
