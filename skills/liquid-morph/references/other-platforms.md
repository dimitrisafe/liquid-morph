# Other platforms

For any toolkit not covered by its own guide, port `spec.md`. Its sections 3 to 6 are plain arithmetic. These notes cover the platform-specific parts for the common cases. None of them is verified here, so check the result in slow motion against `spec.md` section 9.

## Web without React (Vue, Svelte, Solid, Angular, plain DOM)

The React engine does all its per-frame work with plain DOM calls: an SVG filter, `clip-path`, inline styles and `requestAnimationFrame`. Only the lifecycle is React. Port `assets/liquid-morph.tsx` by keeping its `tick()` and helpers, and replacing:

- the hooks with the framework's lifecycle;
- the portal with a container appended to the root;
- `useState` phases with plain variables.

The goo, the ghost copies and the landing logic carry over unchanged.

## Flutter

- **Clock.** A `Ticker` (or an unbounded `AnimationController`), calling `step()` every frame.
- **Measuring.** A `GlobalKey` on the trigger and on the root. Take the rect from `trigger.localToGlobal(Offset.zero, ancestor: rootRenderObject)`.
- **Layering.** A `Stack` at the root, with the morph layer as its last child. Use an `Overlay` entry for full-screen roots.
- **Goo.** Wrap the liquid's `CustomPaint` in `ImageFiltered(imageFilter: ImageFilter.compose(outer: ColorFilter.matrix(m), inner: ImageFilter.blur(sigmaX: σ, sigmaY: σ)))`. Flutter's matrix offsets are in 0–255. Use no filter at rest.
- **Content.** `Transform` with `alignment: Alignment.topLeft` and scale `fit`, then `Opacity` and `ImageFiltered(blur)`, all inside a `ClipPath` on the liquid's rounded rect.
- **Trigger.** Use the real trigger under the liquid, with the opacities from the end of `spec.md` section 6.
- **Reduced motion.** `MediaQuery.of(context).disableAnimations`.

## React Native

- **Drawing.** Use `@shopify/react-native-skia` for the liquid: a `Group` with a layer paint holding `<Blur blur={σ} />` and `<ColorMatrix matrix={…} />`. Skia's offsets are in 0–1. Check that alpha clamps, and if it doesn't, use a `RuntimeShader` that thresholds with `smoothstep`.
- **Clock.** `useFrameCallback` from Reanimated, or Skia's `useClock`, with the engine state in shared values so it runs on the UI thread.
- **Measuring.** `measure` (Reanimated) or `measureLayout` relative to the root view.
- **Content.** An `Animated.View` with `transform: [{ translateX }, { translateY }, { scale: fit }]` around a top-left origin, clipped by a `MaskedView` or Skia clip of the liquid's rounded rect.
- **Trigger.** Use the real trigger under the liquid, as for Flutter.
- **Reduced motion.** `AccessibilityInfo.isReduceMotionEnabled()`.

## Anything else

Implement `spec.md` sections 3 to 6 as written. Then find the toolkit's three primitives:

1. a per-frame clock;
2. rect measurement in a shared coordinate space;
3. a blur followed by an alpha threshold that clamps.

If there is no filter support at all, draw the liquid without goo. The corner swell, the bulge, the colour blend and the size-aware timing still make it read as liquid.
