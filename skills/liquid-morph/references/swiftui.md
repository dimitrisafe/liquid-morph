# SwiftUI and UIKit

The skill ships a SwiftUI engine, `assets/swiftui/LiquidMorph.swift`, that implements `spec.md`. It needs iOS 17 or newer and has no dependencies. It is verified on the iOS Simulator for a menu from an avatar, a sidebar from a toggle and a bottom sheet from a button, and compiles in both Swift 5 and Swift 6 language modes.

## 1. Install

Copy `assets/swiftui/LiquidMorph.swift` into the app target (or a shared UI module). Nothing else is needed.

## 2. Wire it

Two modifiers. `.liquidMorphRoot()` goes on the container the panel lives in. `.liquidMorph(isPresented:…)` goes on the trigger, the way `.sheet` does.

```swift
struct Checkout: View {
    @State private var open = false

    var body: some View {
        ZStack(alignment: .bottom) {
            PageContent()
                .liquidMorphRecede()                     // optional: shrinks a little while open

            Text("Pay now")
                .font(.headline)
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(.white, in: Capsule())
                .onTapGesture { open = true }
                .liquidMorph(
                    isPresented: $open,
                    fill: .white, cornerRadius: 28,      // the trigger's own fill and corner radius
                    panel: .white, panelRadius: 40,
                    placement: .sheet(inset: 8)
                ) {
                    PaySheet(done: { open = false })
                } label: {
                    Text("Pay now").font(.headline).foregroundStyle(.black)
                }
                .padding(20)
        }
        .liquidMorphRoot()
    }
}
```

| Parameter | Meaning |
| --- | --- |
| `isPresented` | Controlled, like `.sheet`. Set it to false from inside the panel to close. |
| `fill`, `cornerRadius` | The trigger's own background colour and corner radius. SwiftUI can't read them from the view, so pass them. The liquid starts in `fill`. |
| `panel`, `panelRadius` | The panel's colour and corner radius. Don't give the panel content its own background; the liquid is the background. |
| `placement` | Where the panel rests in the root: `.sheet(inset:)` for a bottom sheet, or `MorphPlacement(top:bottom:leading:trailing:width:height:)`, solved like absolute positioning. The height comes from the content unless `height`, or both `top` and `bottom`, fix it. |
| `scrim` | Colour laid over the root at full openness; tapping it closes. `nil` makes the panel non-modal. |
| `shadow` | `MorphShadow(color:radius:x:y:)`, grown in with the liquid. |
| `onLanded` | Runs after every close, once the liquid is back on the trigger. Apply results here. |
| `content` | The panel. It's laid out at the panel's width, and its height drives the liquid. |
| `label` | The trigger's content alone (text or icon), without its background. It's drawn where the liquid leaves and lands. |

`.environment(\.liquidMorphSpeed, 0.25)` on any ancestor plays every morph below it at quarter speed, for checking the motion.

## 3. Recipes

The recipe table in `SKILL.md` applies; translate `place` into `MorphPlacement`:

- **Sidebar.** `MorphPlacement(top: 8, bottom: 8, leading: 8, width: 260)`, a light scrim, and the sidebar's own toggle at the trigger's spot inside the panel.
- **Menu from an avatar or pill.** `MorphPlacement(top: triggerTop, trailing: 16, width: 260)`, so the panel's corner sits on the trigger's corner.
- **Button into a button** (Add to bag into a stepper). The destination's exact box, `scrim: nil`.

## 4. How the port maps to the spec

- **Frame clock.** `TimelineView(.animation)`, paused while idle. The engine steps once per frame timestamp.
- **Frames.** `anchorPreference(.bounds)` on the trigger, resolved by the root's `overlayPreferenceValue`. The panel's height is measured with a `GeometryReader` preference.
- **Goo.** A `Canvas` with `.blur`, `.alphaThreshold(min: 0.5, color: fill)` and a 0.5-point blur. SwiftUI's `.colorMatrix` doesn't clamp alpha, so the web version's contrast matrix would turn dark fills light. At rest the filters are skipped, so the liquid lands as the trigger's exact shape.
- **Warm-up.** The root runs the filter chain once on an invisible shape, because the first use otherwise stalls for most of the first open.
- **Trigger look.** SwiftUI can't copy a view's look, so the real trigger stays under the liquid and comes back fully before the liquid fades off it.
- **Reduced motion.** With Reduce Motion on, the panel and scrim crossfade in 200 ms at their resting place.

## 5. UIKit

There is no UIKit engine. Two routes:

- **Host the SwiftUI one.** Put the screen, or just the trigger and its container, in a `UIHostingController`. This is the quickest and keeps the verified engine.
- **Port it.** Follow `spec.md` with a `CADisplayLink` for the clock and `convert(_:to:)` into the root view for frames. Draw the liquid in a `CAShapeLayer` inside a view whose layer renders through a Core Image or Metal goo pass (blur, then a smoothstep alpha threshold that clamps), and clip the panel with a `CAShapeLayer` mask on the liquid's path. Show the trigger's snapshot (`snapshotView(afterScreenUpdates:)`) as the look copy.

## 6. Verify

Run it on a simulator or device with `.environment(\.liquidMorphSpeed, 0.25)` and record the screen (`xcrun simctl io booted recordVideo`). Then step through the frames:

- The first open after launch is as smooth as the second.
- The liquid starts in the trigger's colour and blends to the panel's.
- The content resolves from blur and never shows tiny.
- A rounded-square trigger lands as a rounded square, not a circle.
- A ring around the trigger returns only on the last frames.
- The landing never flashes lighter.
