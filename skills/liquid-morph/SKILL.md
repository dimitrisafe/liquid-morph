---
name: liquid-morph
description: Build a liquid (gooey) morph where one element pours into another and back, on the web, iOS or Android. Any trigger can pour into the element it opens, at any size and anywhere in its container, such as a button into a bottom sheet, modal or composer, a sidebar toggle into a sidebar, an avatar into an account menu, a menu pill into a nav, a search icon into a search panel, a status pill into a picker, a button into a stepper, a card into a mini player. Ships a one-file React engine, a one-file SwiftUI engine, and a platform-neutral spec with guides for Jetpack Compose, Compose Multiplatform, Kotlin Multiplatform, UIKit, Flutter and React Native, all timed by the size of the element. Use whenever the user wants an element to morph, pour, melt or grow out of the control that opens it, or asks for a "liquid", "gooey", "blob" or "morphing" sidebar, drawer, sheet, popover, dropdown, menu, panel, picker, search, toolbar or modal, in any UI framework, even if they never say "liquid".
license: MIT
metadata:
  author: Dimitris Afentakis
  website: https://www.dimitrisafentakis.com
  homepage: https://www.dimitrisafentakis.com/skills/liquid-morph
  version: 1.2.0
---

# Liquid morph

One element becomes another. The liquid flows out of the trigger's box into the panel's box, wherever and whatever size the panel is. Its colour blends from the trigger's to the panel's, a bulge rides the leading edge, and the content resolves from blur. On close it pours back, lands exactly on the trigger, and the trigger's label resolves where it lands.

Whether an element morphs or gets a plain entrance is the designer's call. Any open and close can be a morph: a sidebar, a menu, a picker, a sheet. The engine sizes the motion itself, so the same wiring suits a 40-point avatar and a full-height sidebar.

## 1. Pick the platform

Read the guide for the project's UI toolkit, and only that one. Every engine follows `references/spec.md`.

| Project | Engine | Read |
| --- | --- | --- |
| React, Next.js, Vite | `assets/liquid-morph.tsx` (or `.jsx`), installed by `scripts/install.mjs` | `references/react.md` |
| SwiftUI (iOS 17+) | `assets/swiftui/LiquidMorph.swift`, copied into the app target | `references/swiftui.md` |
| UIKit | Host the SwiftUI engine, or port the spec | `references/swiftui.md`, section 5 |
| Jetpack Compose, Compose Multiplatform, Kotlin Multiplatform | Port the spec | `references/compose.md`, then `references/spec.md` |
| Flutter, React Native, Vue, Svelte, anything else | Port the spec | `references/other-platforms.md`, then `references/spec.md` |

When porting, implement `spec.md` exactly, constants included. Verify the port in slow motion before calling it done (section 5).

## 2. Recipes

Pick the row closest to the request. The destination is the panel's resting box in the root. Put its corner on the trigger's corner, so the liquid grows out of the trigger instead of jumping to it.

| Pattern | Trigger | Destination box | Scrim | Close from |
| --- | --- | --- | --- | --- |
| Bottom sheet | Full-width button at the bottom | Docked to the bottom, `inset` in from the edges | Default dim; drag to dismiss on mobile | Sheet buttons, the scrim, a drag |
| Sidebar | Sidebar toggle in the window corner | `left 10, top 10, bottom 10, width 240` | Light, such as white at 50%; recede 0.985 | A toggle inside the sidebar, at the trigger's spot |
| Account menu or dropdown | Avatar or menu pill in the header | `top` and `right` of the pill, `width 280` | Transparent | Picking an item, the scrim |
| Nav | Menu pill in a site header | `top 16, right 24, width 320` | Light; recede 0.985 | A close button where the pill was |
| Search | Search icon at the end of a field | The field's box, grown downward | None | Picking a result |
| Composer | "Ask AI" or "New" button | Centred on the button, wider: `width 400` | None | Send |
| Picker | Status pill, time button | Corner on the pill's corner | None | Picking (close about 150 ms after the pick) |
| One trigger, several bars | A pill of tool icons | The bar's exact box, such as `width 470, height 62` | None | An × in the bar |
| Button into a button | "Add to bag" | The destination's exact box, such as `width 148, height 56` | None | The destination itself (− at a count of 1) |
| Container into a button | A now-playing card | The pill's box | None; no recede | The pill |

- **Sidebar.** Give the panel a full-height layout (both `top` and `bottom`). Put the sidebar's own close toggle at exactly the trigger's position, so the liquid lands back under the pointer.
- **One trigger, several bars.** Keep one morph. Each icon sets a mode and opens; the panel shows the bar for that mode.
- **Picker that changes the trigger.** Change the trigger's state (colour, label) before closing. The liquid pours back in the new colour and lands carrying the new label.
- **Button into a button.** Anything beside it, such as a "1 item" summary, is ordinary page state with its own transition.
- **Container into a button.** The card is the trigger and the pill is the panel. Open from a collapse control inside the card, and close from the pill.

## 3. Motion foundations

Every engine applies these on its own: proven UI motion rules, adapted to a liquid. Keep them when porting, and don't retune the constants.

- **Size sets the time.** A flight's duration comes from how far the liquid's farthest edge travels, from a short hop of 60 to a long pour of 560. Opening runs 190 to 340 ms, closing 170 to 300 ms, and a content resize while open 160 to 280 ms. A status picker opens in about 220 ms, a menu in about 270, and a full sheet or sidebar in 300 to 340.
- **Size sets the curve.** Short hops use `cubic-bezier(0.45, 0.6, 0.35, 1)`. Long pours front-load their motion with the sheet curve `cubic-bezier(0.32, 0.72, 0, 1)`, so the extra time reads as weight rather than lag.
- **Exits are shorter.** Closing takes about 0.88 of the open time. The scrim fades out 1.35× slower than the liquid closes, so the page settles after the landing.
- **Nothing grows from nothing.** The content rides the liquid at the liquid's width, and shows only once it is drawn within 60 to 90% of its real size. It fades in with a 6-point blur clearing, smoothed so it never flashes in a frame or two. It keeps its padding and layout through a close, and a panel that comes out shorter than the liquid, such as a bar, rides in the liquid's middle.
- **It lands exactly.** The goo fades out over the last stretch of a close, so the liquid settles into the trigger's exact shape and corner radius. The trigger's own look (gradient, ring, glow) fades back in at the liquid's shape over the last quarter of a close, so a gradient flows in instead of popping in on the landing frame, and the bulge relaxes as it does. It never flashes lighter. SwiftUI can't copy a view, so it does this when the trigger passes its look (`look:`). Without one, and on toolkits that can't copy a view (Compose), the real trigger comes back over the last frames instead.
- **Wobble is fixed in points.** Corners swell by 24 mid-flight, and a bulge of up to 14 rides the edge that travels farthest. A fixed amount reads livelier on a small element and calmer on a big one, the way spring bounce should scale with size.
- **Interruptible.** Retargeting carries the current velocity, so closing mid-open reverses from where it is.
- **Reduced motion is gentler, not absent.** It swaps the morph for a 200 ms crossfade.

What the morph leaves to you, by the same rules:

- **Press feedback.** Triggers scale to 0.97 while pressed, over 150 ms with an ease-out curve. Keep hover to a colour change or at most 2% scale, and only on devices with a fine pointer.
- **Frequency.** The morph suits things opened now and then: sheets, menus, sidebars, pickers. Something opened by a keyboard shortcut or dozens of times a day, such as a ⌘K palette, is a poor fit. Raise it with the designer before morphing it.
- **One entrance per container.** Don't animate the panel's children in. The engine resolves the content as a whole.

## 4. Design rules

- **Let the content size drive the liquid.** A multi-step panel that grows or shrinks is followed by the liquid. Never animate the panel's height yourself.
- **Apply results on landing.** When a panel action finishes, keep the result aside, close, and apply it in the landing callback, so the page changes where the eye lands. The callback also fires for plain dismissals, so it must apply only what an action stashed.
- **Swap the trigger's label after landing** (for example to "Added"), so the liquid lands on the label it left. The exception is a picker whose trigger shows the picked value: change that before the close.
- **Keep the panel inside its root.** Use one root per morph.
- **Watch the colour blend.** A dark trigger opening a light panel reads as the button filling up on a dark page; on a light page the blend passes through grey. If that reads muddy, bring the panel colour closer to the trigger's.
- **Separate a panel from a same-coloured page** with a soft shadow, and keep the scrim.
- **Give the destination a different size from the trigger.** Openness is read from the size change, so a same-size move falls back to the clock.
- **Gradient triggers** need a solid base colour close to the gradient's middle. The liquid flows in that colour, and the gradient fades back in over the end of the close (in SwiftUI, pass the gradient as `look:`, or it returns on the last frames).

## 5. Verify

A passing build doesn't prove the motion. Run it, slow it to 0.1 to 0.25 speed (every engine has a speed multiplier), record the screen, and step through the frames. Check:

- the first open after launch is as smooth as the second;
- the liquid starts in the trigger's colour and blends to the panel's;
- the content never shows tiny, and resolves from blur;
- a rounded-square trigger lands as a rounded square, and its gradient or ring fades back in as it lands, never popping in on the last frame;
- the content keeps its padding and layout the moment a close starts, and a bar's content stays centred as it shrinks;
- the landing never flashes lighter;
- a close while still opening reverses smoothly;
- reduced motion gives the crossfade.

## Maintaining this skill

`references/spec.md` is the contract. A behaviour change goes into the spec and into both shipped engines, then each is verified as above.
