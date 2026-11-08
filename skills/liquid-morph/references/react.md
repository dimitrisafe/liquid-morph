# React, Next.js and Vite

The skill ships the reference engine: `assets/liquid-morph.tsx`, with a generated `assets/liquid-morph.jsx` for JavaScript projects. It needs React 18 or newer and react-dom, and nothing else.

## 1. Install the engine

From the project root, run the script in this skill's base directory:

```bash
node <skill-dir>/scripts/install.mjs .
```

It copies the engine into `src/components/` or `components/`, keeps `'use client'` only for Next.js, and prints JSON with `file`, `react`, `framework`, `typescript`, `motion` and `tailwind`.

- **Another folder.** Use `--dest <dir>`.
- **Updates.** Rerun it after the skill changes. An unedited copy is updated in place. An edited copy is refused: diff the two, then rerun with `--force`.
- **Nothing is npm-installed.** If the script reports the project isn't a React DOM project, see `other-platforms.md` instead of adding React.
- **Use the report.** If `motion` is present, you may use it for transitions inside the panel; if it's absent, use CSS transitions and don't install it for this. If `tailwind` is present, style the trigger and the panel content with classes as usual.

## 2. Wire it

Three parts, all inside one root element:

```tsx
import { useState } from 'react'
import { Morph } from '@/components/liquid-morph'

export function Checkout() {
  const [open, setOpen] = useState(false)
  return (
    <div data-morph-root className="relative h-[720px] w-[393px] overflow-hidden rounded-[48px] bg-neutral-950 text-white">
      <main data-morph-recede className="p-6">…page…</main>
      <button
        data-morph-id="pay"
        onClick={() => setOpen(true)}
        className="absolute inset-x-5 bottom-6 h-14 rounded-full bg-white font-semibold text-black transition-transform duration-150 ease-out active:scale-[0.97]"
      >
        Pay now
      </button>
      <Morph open={open} source="pay" panel="#ffffff" radius={40} inset={8} label="Pay" ghost="Pay now" drag onDismiss={() => setOpen(false)} className="text-black">
        <div className="p-6">…sheet content…</div>
      </Morph>
    </div>
  )
}
```

- **Root** (`data-morph-root`). The element the panel lives in. It must contain both the trigger and the panel's resting place. The engine makes a static root `position: relative` and `isolation: isolate`. Add `overflow: hidden` when the panel must be clipped to it.
- **Trigger** (`data-morph-id`).
  - It needs an opaque background, because the liquid starts in that colour.
  - A gradient trigger needs a solid `background-color` under its `background-image`. Pick a base colour close to the gradient's middle.
  - It stays mounted while the panel is open: the engine hides it, then shows it again on the frame the liquid lands.
- **`<Morph>`** goes anywhere inside the root. Its layers are portaled into the root.

In Next.js the engine file is `'use client'`, so render `Morph` and `MorphSpeed` from a client component. To drive the speed from the URL in the App Router, read `searchParams` in the server page and pass a `speed` prop down, or use `useSearchParams` inside a `<Suspense>` boundary.

| Prop | Meaning |
| --- | --- |
| `open`, `onDismiss` | Controlled. `onDismiss` fires on a scrim click, Escape, and a drag pull. |
| `place` | Where the panel rests inside the root, as a style object such as `{ top: 16, right: 24, width: 320 }`. Omit it for the bottom sheet. |
| `source` | The trigger's `data-morph-id`. |
| `panel` | The panel colour, as hex or rgb(a). Set the panel background here, not in `className`. |
| `radius`, `inset` | The panel's corner radius, and the sheet's gap to the root's edges (default 8). For concentric corners, `radius` = root radius − `inset`. |
| `label` | The dialog's accessible name. |
| `ghost` | The trigger's content only, such as its label string or icon element. The engine renders it inside a copy of the trigger that has the trigger's tag and classes, without its fill, border, shadow or `::before`/`::after` decorations. A second, empty copy brings the trigger's look back as the liquid lands. Don't repeat the trigger's classes here. |
| `scrim` | Overlay colour at full openness. Default `rgba(0, 0, 0, 0.2)`. `false` makes the morph non-modal: no overlay, no Escape, and the page stays usable. |
| `recede` | Scale for `[data-morph-recede]` elements at full openness. Default `0.97`. |
| `shadow` | box-shadow syntax. It grows in with the liquid. |
| `drag` | Pull the panel down to dismiss. Use it for mobile sheets. |
| `top` | Sheet only. Pixels kept free above the panel, so a widget's header stays visible. |
| `onLanded` | Runs after the liquid lands back on the trigger: after every close, whatever closed it, and never on mount. |
| `className` | Panel padding, text colour and layout. It lands on the panel surface, and the children sit inside an inner `.m-content` wrapper, so put flex or grid layouts on a wrapper of your own. |

## 3. Recipe notes for React

The recipe table in `SKILL.md` gives the destination box for each pattern; pass it as `place`.

- **Sidebar.** Use `place` with both `top` and `bottom`, and `.your-panel > .m-content { height: 100% }`, so the content can fill the panel.
- **One trigger, several bars.** Keep one `Morph`. Each icon sets a `mode` state and opens; the panel renders the bar for the current mode.
- **Container into a button.** Pass the card's inner content again as `ghost` (the copy is inert). Float the container with absolute positioning, because it keeps its space, invisible, while collapsed.
- **Applying results on landing.** Stash the result in a ref and close, then apply it in `onLanded`. Use a ref, not state, because `onLanded` also fires for plain dismissals, which must apply nothing:

  ```tsx
  const pending = useRef<number | null>(null)
  const confirm = () => { pending.current = amount; setOpen(false) }
  const landed = () => {
    if (pending.current === null) return
    setBalance((b) => b + pending.current!)
    pending.current = null
  }
  // <Morph … onLanded={landed}>
  ```

## 4. Verify

- **Slow it down.** Wrap the page in `<MorphSpeed.Provider value={0.25}>` (`MorphSpeed` comes from the same file) and check an open, a close, and a close while it's still opening.
- **Look at it in a browser.** Drive it with the project's dev server and screenshot mid-flight at 0.25 speed. A passing build doesn't prove the motion.
- **Reduced motion.** Emulate `prefers-reduced-motion: reduce` and check that the fade replaces the morph.

`--morph-q` (0 to 1) is written on the root every frame. Read it in CSS for extra effects tied to openness.

## 5. Troubleshooting

- **The scrim shows but the panel is invisible.** `<Morph>` isn't inside a `data-morph-root`. The console warns about it.
- **The liquid starts in the wrong colour.** The trigger has a transparent background, or a gradient with no `background-color` under it.
- **The liquid lands off the trigger.** The trigger moved during the close, or the root is rotated. Scaled roots are supported.
- **Escape or a click outside does nothing.** The morph has `scrim={false}`, which is non-modal by design. Close it from a control inside the panel.
- **The panel content pops in at full size.** The content runs its own entrance animation. Remove it.
- **Something flashes over the trigger's label as it lands.** Look for a `z-index` or `position` rule that only some of the trigger's states have. The engine pins its copies of the trigger to `z-index: auto`.
- **A full-height panel's content stops short.** Give `.your-panel > .m-content` `height: 100%`, and lay out on a wrapper inside it.

## 6. Maintaining the engine

After editing `assets/liquid-morph.tsx`, regenerate the JS copy with `node <skill-dir>/scripts/build-jsx.mjs`. The engine adds one `<style id="liquid-morph-css">` to the document head, which hides `::before` and `::after` on its label copy of the trigger. Behaviour changes go into `spec.md` too, so the other platforms can follow.
