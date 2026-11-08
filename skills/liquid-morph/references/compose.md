# Jetpack Compose, Compose Multiplatform and Kotlin Multiplatform

There is no shipped Kotlin engine. Port `spec.md`: its sections 3 to 6 are plain arithmetic and translate line by line into Kotlin. This guide covers the parts that are specific to Compose: the clock, measuring, layering, the goo and the trigger. The SwiftUI engine (`assets/swiftui/LiquidMorph.swift`) is a complete port of the same spec, and the closest model for a declarative toolkit.

This guide hasn't been run on a device. After porting, verify it the way section 7 describes before calling it done.

## 1. Where the code goes

- **Android only.** One file, for example `ui/LiquidMorph.kt`.
- **Kotlin Multiplatform with native UIs.** Put the engine (rects, flights, `step()`, the frame values) in `commonMain`. It has no UI imports. Android draws it with Compose; an iOS SwiftUI app can use the shipped Swift engine instead, or call the shared Kotlin engine.
- **Compose Multiplatform.** The engine and the composables both go in `commonMain`. Only the goo effect needs `expect`/`actual`, because Android and Skia build it differently (section 4).

## 2. Engine shape

```kotlin
data class MRect(val x: Float, val y: Float, val w: Float, val h: Float, val r: Float)

class MorphFrame(
    val liquid: Boolean, val body: MRect, val bulge: Rect?, val goo: Float, val fill: Color,
    val liquidAlpha: Float, val q: Float, val fit: Float, val restWidth: Float, val ride: Float,
    val labelAlpha: Float, val labelBlur: Float, val trigger: MRect, val triggerAlpha: Float, val scrim: Float,
)

class MorphEngine {
    var wantOpen = false                // set from the composable's `open` parameter
    var active by mutableStateOf(false) // true from the open until the scrim tail ends
    var frame by mutableStateOf(MorphFrame.Idle)
        private set
    fun step(nowSeconds: Double, trigger: MRect, rest: MRect?) { /* spec.md sections 5 and 6 */ }
}
```

Port `rectAt`, `velocityAt`, `startFlight`, `progress`, `leadingEdge` and the bezier solver from `spec.md` as written. Keep the constants exactly.

## 3. Clock, measuring and layering

```kotlin
@Composable
fun LiquidMorphRoot(content: @Composable LiquidMorphScope.() -> Unit) {
    var root by remember { mutableStateOf<LayoutCoordinates?>(null) }
    Box(Modifier.fillMaxSize().onGloballyPositioned { root = it }) {
        LiquidMorphScope(root).content()   // pages, triggers, and the morph layers, last
    }
}

// On the trigger: measure it in the root's space, and hide it while the liquid stands in for it.
Modifier
    .onGloballyPositioned { coords -> trigger = root?.localBoundingBoxOf(coords) }
    .graphicsLayer { alpha = engine.frame.triggerAlpha }

// The clock: one step per frame while active.
LaunchedEffect(engine.active) {
    while (engine.active) {
        withFrameNanos { t -> engine.step(t / 1e9 * speed, trigger, rest) }
    }
}
```

- Put the morph layer as the last child of the root `Box`, with `Modifier.matchParentSize()`, so it draws above the page.
- Read `engine.frame` inside `graphicsLayer {}`, `drawBehind {}` and `offset {}` lambdas where you can. That keeps per-frame work in the draw phase instead of recomposing every frame.
- Measure the panel's height by laying the content out at the resting width (`Modifier.requiredWidth(restWidth)`) and reading `onSizeChanged`. While the height is unknown, stay in `opening`.

## 4. The goo

Draw the liquid body and the bulge in their own layer and give that layer a blur followed by an alpha threshold:

```kotlin
Canvas(Modifier.matchParentSize().graphicsLayer { renderEffect = gooEffect(frame.goo, density) }) {
    drawRoundRect(frame.fill, topLeft = …, size = …, cornerRadius = CornerRadius(frame.body.r))
    frame.bulge?.let { drawOval(frame.fill, it.topLeft, it.size) }
}
```

`gooEffect` returns null at rest (`goo ≤ 0.001`), so the liquid lands as the trigger's exact shape.

**Android 12+ (API 31).** Android's colour matrix clamps, so the spec's contrast matrix works as written. Its offsets are in 0–255:

```kotlin
fun gooEffect(goo: Float, density: Float): RenderEffect? {
    if (goo <= 0.001f || Build.VERSION.SDK_INT < 31) return null
    val c = 1f + 21f * goo
    val matrix = android.graphics.ColorMatrix(floatArrayOf(
        1f, 0f, 0f, 0f, 0f,
        0f, 1f, 0f, 0f, 0f,
        0f, 0f, 1f, 0f, 0f,
        0f, 0f, 0f, c, minOf(0f, 0.5f - c * 5f / 12f) * 255f,
    ))
    val sigma = 10f * goo * density
    val blur = android.graphics.RenderEffect.createBlurEffect(sigma, sigma, Shader.TileMode.DECAL)
    return android.graphics.RenderEffect
        .createColorFilterEffect(android.graphics.ColorMatrixColorFilter(matrix), blur)
        .asComposeRenderEffect()
}
```

Below Android 12 there are no render effects: draw the shapes without goo. The corner swell, the bulge and the timing still read as liquid. On Android 13+ you can instead write one AGSL `RuntimeShader` that blurs and thresholds with `smoothstep`, if the chained effect proves too slow.

**Compose Multiplatform on iOS, desktop and web (Skia).** Build the same chain from Skia filters. Skia's colour-matrix offsets are in 0–1:

```kotlin
// skikoMain (or iosMain / desktopMain / wasmJsMain)
actual fun gooEffect(goo: Float, density: Float): RenderEffect? {
    if (goo <= 0.001f) return null
    val c = 1f + 21f * goo
    val sigma = 10f * goo * density
    val blur = ImageFilter.makeBlur(sigma, sigma, FilterTileMode.DECAL)
    val matrix = ColorMatrix(
        1f, 0f, 0f, 0f, 0f,
        0f, 1f, 0f, 0f, 0f,
        0f, 0f, 1f, 0f, 0f,
        0f, 0f, 0f, c, minOf(0f, 0.5f - c * 5f / 12f),
    )
    return ImageFilter.makeColorFilter(ColorFilter.makeMatrix(matrix), blur, null).asComposeRenderEffect()
}
```

Check two things against your Compose and Skia versions, because both have changed across releases: that the colour matrix clamps alpha, and that its offset units are as above. If alpha isn't clamped, dark fills turn light: switch to a runtime shader that thresholds with `smoothstep(0.42, 0.5, a)`.

**Warm-up.** Render the goo layer once with an invisible shape when the root first composes, so building the filters doesn't stall the first open.

## 5. The panel and the trigger

- **Clip.** Wrap the content and the label in a layer clipped to the liquid: `Modifier.drawWithContent { clipPath(liquidPath) { this@drawWithContent.drawContent() } }`.
- **Content.** Offset it to the liquid's corner (`Modifier.offset { IntOffset(R.x, R.y) }`), lay it out at the resting width, and give it `graphicsLayer { transformOrigin = TransformOrigin(0f, 0f); scaleX = fit; scaleY = fit; alpha = ride; renderEffect = BlurEffect(blur, blur) }`.
- **Label copy.** The trigger's content alone, at the trigger's rect, with `alpha = labelAlpha` and a `BlurEffect` of `labelBlur`.
- **Trigger look.** Compose can't copy a view's look, so use the real trigger under the liquid, with the opacities from the end of `spec.md` section 6. Bring it in fully before the liquid fades off it; never crossfade the two over the same frames.
- **Scrim.** A full-size `Box` with `background(scrim.copy(alpha = frame.scrim))`, clickable to dismiss while open.

## 6. Reduced motion

- **Android.** Treat `Settings.Global.ANIMATOR_DURATION_SCALE == 0f` as reduced motion.
- **iOS (Compose Multiplatform).** Use `UIAccessibility.isReduceMotionEnabled()` through `expect`/`actual`.

In either case, crossfade the panel in 200 ms at its resting place instead of morphing (`spec.md` section 8).

## 7. Verify

Set the speed multiplier to 0.25 and record the screen (`adb shell screenrecord`, or the simulator's recorder for Compose on iOS). Then step through the frames for the same checks as `spec.md` section 9:

- The first open after launch is smooth.
- The colour blends from the trigger to the panel.
- The content resolves from blur.
- A rounded-square trigger lands square, and a ring returns only on the last frames.
- The landing never flashes lighter.
- Closing mid-open reverses smoothly.
