// Liquid morph for SwiftUI (iOS 17+). A trigger pours into the panel it opens, and back.
// Implements references/spec.md of the liquid-morph skill. Drop this one file into the app target.
//
//   VStack { … }
//       .liquidMorphRoot()                       // the container the panel lives in
//
//   Button("Pay now") { open = true }
//       .liquidMorph(isPresented: $open, fill: .white, cornerRadius: 28,
//                    panel: .white, panelRadius: 40, placement: .sheet(inset: 8)) {
//           PaySheet()                           // the panel's content
//       } label: {
//           Text("Pay now")                      // the trigger's content, without its background
//       }

import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Public API

/// Where the panel rests inside the root, like absolute positioning: unset sides are solved from
/// the others, and the height comes from the content unless `height`, or `top` with `bottom`, fix it.
public struct MorphPlacement: Equatable, Sendable {
    public var top: CGFloat?
    public var bottom: CGFloat?
    public var leading: CGFloat?
    public var trailing: CGFloat?
    public var width: CGFloat?
    public var height: CGFloat?

    public init(top: CGFloat? = nil, bottom: CGFloat? = nil, leading: CGFloat? = nil, trailing: CGFloat? = nil, width: CGFloat? = nil, height: CGFloat? = nil) {
        self.top = top
        self.bottom = bottom
        self.leading = leading
        self.trailing = trailing
        self.width = width
        self.height = height
    }

    /// A bottom sheet `inset` points in from the root's left, right and bottom edges.
    public static func sheet(inset: CGFloat = 8) -> MorphPlacement {
        MorphPlacement(bottom: inset, leading: inset, trailing: inset)
    }

    var isSheet: Bool { top == nil && height == nil && bottom != nil }
    var fixesHeight: Bool { height != nil || (top != nil && bottom != nil) }

    func rect(in root: CGSize, contentHeight: CGFloat) -> CGRect {
        let w = width ?? max(0, root.width - (leading ?? 0) - (trailing ?? 0))
        let x = leading ?? trailing.map { root.width - $0 - w } ?? (root.width - w) / 2
        let h: CGFloat
        if let height { h = height } else if let top, let bottom { h = max(0, root.height - top - bottom) } else { h = contentHeight }
        let y = top ?? bottom.map { root.height - $0 - h } ?? (root.height - h) / 2
        return CGRect(x: x, y: y, width: w, height: h)
    }
}

/// A drop shadow that grows in with the liquid.
public struct MorphShadow: Sendable {
    public var color: Color
    public var radius: CGFloat
    public var x: CGFloat
    public var y: CGFloat
    public init(color: Color = .black.opacity(0.2), radius: CGFloat = 24, x: CGFloat = 0, y: CGFloat = 12) {
        self.color = color
        self.radius = radius
        self.x = x
        self.y = y
    }
}

extension View {
    /// Makes this view the container morphs live in: the screen, or the card the panel belongs to.
    public func liquidMorphRoot() -> some View {
        modifier(MorphRootModifier())
    }

    /// Scales this view back a little while a morph in the same root is open.
    public func liquidMorphRecede(_ scale: CGFloat = 0.97) -> some View {
        modifier(MorphRecedeModifier(scale: scale))
    }

    /// Makes this view the trigger of a liquid morph. It pours into `content` when `isPresented`
    /// turns true and lands back on itself when it turns false.
    /// - Parameters:
    ///   - fill: the trigger's own background colour; the liquid starts in it.
    ///   - cornerRadius: the trigger's corner radius (capped at half its height).
    ///   - panel: the panel's colour; the liquid blends to it.
    ///   - scrim: the colour laid over the root at full openness, or nil for a non-modal panel.
    ///   - onLanded: runs after every close, once the liquid has landed back on the trigger.
    ///   - label: the trigger's content alone (text or icon), drawn where the liquid leaves and lands.
    public func liquidMorph<Panel: View, Label: View>(
        isPresented: Binding<Bool>,
        fill: Color,
        cornerRadius: CGFloat,
        panel: Color,
        panelRadius: CGFloat,
        placement: MorphPlacement = .sheet(),
        scrim: Color? = .black.opacity(0.2),
        shadow: MorphShadow? = nil,
        onLanded: (() -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Panel,
        @ViewBuilder label: @escaping () -> Label
    ) -> some View {
        modifier(MorphTriggerModifier(
            isPresented: isPresented,
            config: MorphConfig(fill: RGBA(fill), triggerRadius: cornerRadius, panel: RGBA(panel), panelColor: panel, radius: panelRadius, placement: placement, scrim: scrim, shadow: shadow),
            onLanded: onLanded,
            panelContent: content,
            label: label
        ))
    }
}

extension EnvironmentValues {
    /// Playback rate of every morph below: 0.25 plays them at quarter speed, for checking motion.
    public var liquidMorphSpeed: Double {
        get { self[MorphSpeedKey.self] }
        set { self[MorphSpeedKey.self] = newValue }
    }
}

private struct MorphSpeedKey: EnvironmentKey {
    static let defaultValue: Double = 1
}

// MARK: - Constants (references/spec.md, section 2)

private enum K {
    static let blur = 10.0
    static let gooSpan = 0.15
    static let near = 60.0
    static let far = 560.0
    static let open = (190.0, 340.0)
    static let close = (170.0, 300.0)
    static let size = (160.0, 280.0)
    static let curveNear = (0.45, 0.6, 0.35, 1.0)
    static let curveFar = (0.32, 0.72, 0.0, 1.0)
    static let corner = 24.0
    static let lens = 14.0
    static let carryTau = 0.03
    static let lensTau = 0.025
    static let fadeTau = 0.03
    static let contentBlur = 6.0
    static let labelBlur = 8.0
    static let tail = 1.35
    static let landMax = 0.8
    static let fade = 0.2
}

// MARK: - Geometry and helpers (section 3)

struct RGBA: Equatable {
    var r, g, b, a: Double
    init(r: Double, g: Double, b: Double, a: Double) { self.r = r; self.g = g; self.b = b; self.a = a }
    init(_ color: Color) {
        #if canImport(UIKit)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
        self.init(r: Double(r), g: Double(g), b: Double(b), a: Double(a))
        #else
        let c = color.resolve(in: EnvironmentValues())
        self.init(r: Double(c.red), g: Double(c.green), b: Double(c.blue), a: Double(c.opacity))
        #endif
    }
    func mixed(_ o: RGBA, _ t: Double) -> RGBA { RGBA(r: lerp(r, o.r, t), g: lerp(g, o.g, t), b: lerp(b, o.b, t), a: lerp(a, o.a, t)) }
    var color: Color { Color(.sRGB, red: r, green: g, blue: b, opacity: a) }
}

private func clamp01(_ v: Double) -> Double { min(1, max(0, v)) }
private func ramp(_ q: Double, _ a: Double, _ b: Double) -> Double { clamp01((q - a) / (b - a)) }
private func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double { a + (b - a) * t }

struct MRect: Equatable {
    var x, y, w, h, r: Double
    init(x: Double, y: Double, w: Double, h: Double, r: Double) { self.x = x; self.y = y; self.w = w; self.h = h; self.r = r }
    init(_ c: CGRect, r: Double) { self.init(x: c.minX, y: c.minY, w: c.width, h: c.height, r: r) }
    var cg: CGRect { CGRect(x: x, y: y, width: w, height: h) }
    func same(_ o: MRect, _ tol: Double) -> Bool { abs(x - o.x) < tol && abs(y - o.y) < tol && abs(w - o.w) < tol && abs(h - o.h) < tol }
    func sameSize(_ o: MRect, _ tol: Double = 0.5) -> Bool { abs(w - o.w) < tol && abs(h - o.h) < tol }
}

private struct Vel { var x = 0.0, y = 0.0, w = 0.0, h = 0.0 }
private enum Edge { case top, bottom, left, right }

private struct Curve {
    let x1, y1, x2, y2: Double
    func callAsFunction(_ t: Double) -> Double {
        if t <= 0 { return 0 }
        if t >= 1 { return 1 }
        func at(_ a: Double, _ b: Double, _ u: Double) -> Double { 3 * u * (1 - u) * (1 - u) * a + 3 * u * u * (1 - u) * b + u * u * u }
        var lo = 0.0, hi = 1.0
        for _ in 0..<24 {
            let mid = (lo + hi) / 2
            if at(x1, x2, mid) < t { lo = mid } else { hi = mid }
        }
        return at(y1, y2, (lo + hi) / 2)
    }
    static func at(_ k: Double) -> Curve {
        Curve(x1: lerp(K.curveNear.0, K.curveFar.0, k), y1: lerp(K.curveNear.1, K.curveFar.1, k), x2: lerp(K.curveNear.2, K.curveFar.2, k), y2: lerp(K.curveNear.3, K.curveFar.3, k))
    }
}

private func travel(_ a: MRect, _ b: MRect) -> Double {
    max(abs(b.x - a.x), abs(b.y - a.y), abs(b.x + b.w - a.x - a.w), abs(b.y + b.h - a.y - a.h))
}
private func weight(_ px: Double) -> Double { clamp01((px - K.near) / (K.far - K.near)) }

private func progress(_ a: MRect, _ b: MRect, _ at: MRect) -> Double? {
    let wide = abs(b.w - a.w) > abs(b.h - a.h)
    let total = wide ? b.w - a.w : b.h - a.h
    return abs(total) > 1 ? clamp01(((wide ? at.w - a.w : at.h - a.h)) / total) : nil
}

private func leadingEdge(_ a: MRect, _ b: MRect) -> Edge {
    let moved: [(Edge, Double)] = [
        (.top, abs(b.y - a.y)),
        (.bottom, abs(b.y + b.h - a.y - a.h)),
        (.left, abs(b.x - a.x)),
        (.right, abs(b.x + b.w - a.x - a.w)),
    ]
    return moved.reduce(moved[0]) { $1.1 > $0.1 ? $1 : $0 }.0
}

// MARK: - Flights (section 4)

private struct Flight {
    var from: MRect
    var to: MRect
    var t0: Double
    var d: Double
    var vel: Vel
    var edge: Edge
    var ease: Curve

    static func still(_ r: MRect, _ t: Double) -> Flight {
        Flight(from: r, to: r, t0: t, d: 0, vel: Vel(), edge: .top, ease: Curve.at(0))
    }

    func eased(_ t: Double) -> Double { ease(d > 0 ? clamp01(t / d) : 1) }

    func rect(_ t: Double) -> MRect {
        let e = eased(t)
        let carry = t * exp(-t / K.carryTau) * (1 - e)
        let w = lerp(from.w, to.w, e) + vel.w * carry
        let h = lerp(from.h, to.h, e) + vel.h * carry
        let r = lerp(from.r, to.r, e) + K.corner * 4 * e * (1 - e)
        return MRect(x: lerp(from.x, to.x, e) + vel.x * carry, y: lerp(from.y, to.y, e) + vel.y * carry, w: w, h: h, r: min(r, w / 2, h / 2))
    }

    func velocity(_ t: Double) -> Vel {
        if t >= d { return Vel() }
        let dt = 0.008
        let p = rect(t), b = rect(max(0, t - dt))
        func lim(_ v: Double) -> Double { max(-2500, min(2500, v)) }
        return Vel(x: lim((p.x - b.x) / dt), y: lim((p.y - b.y) / dt), w: lim((p.w - b.w) / dt), h: lim((p.h - b.h) / dt))
    }
}

private func edgeSpeed(_ e: Edge, _ v: Vel) -> Double {
    switch e {
    case .top: v.y
    case .bottom: v.y + v.h
    case .left: v.x
    case .right: v.x + v.w
    }
}

private func lens(on e: Edge, _ R: MRect, inset: Double, amp: Double) -> CGRect? {
    switch e {
    case .top, .bottom:
        guard R.w > R.r * 2 + 8 else { return nil }
        let rx = R.w / 2 - R.r - 2, ry = amp + 2
        let cy = e == .top ? R.y + inset + 2 : R.y + R.h - inset - 2
        return CGRect(x: R.x + R.w / 2 - rx, y: cy - ry, width: rx * 2, height: ry * 2)
    case .left, .right:
        guard R.h > R.r * 2 + 8 else { return nil }
        let rx = amp + 2, ry = R.h / 2 - R.r - 2
        let cx = e == .left ? R.x + inset + 2 : R.x + R.w - inset - 2
        return CGRect(x: cx - rx, y: R.y + R.h / 2 - ry, width: rx * 2, height: ry * 2)
    }
}

// MARK: - Engine (sections 5 and 6)

struct MorphConfig {
    var fill: RGBA
    var triggerRadius: CGFloat
    var panel: RGBA
    var panelColor: Color
    var radius: CGFloat
    var placement: MorphPlacement
    var scrim: Color?
    var shadow: MorphShadow?
}

/// Everything one frame draws.
struct MorphFrame {
    var liquid = false
    var body = CGRect.zero
    var bodyRadius = 0.0
    var clip = MRect(x: 0, y: 0, w: 0, h: 0, r: 0)
    var bulge: CGRect?
    var goo = 0.0
    var fill = RGBA(r: 0, g: 0, b: 0, a: 1)
    var liquidOpacity = 1.0
    var q = 0.0
    var fit = 1.0
    var restWidth = 0.0
    var ride = 0.0
    var labelOpacity = 1.0
    var labelBlur = 0.0
    var trigger = CGRect.zero
    var triggerOpacity = 1.0
    var scrim = 0.0
    var interactive = false
}

@MainActor
final class MorphEngine: ObservableObject {
    enum Phase { case idle, opening, open, closing, landed }

    /// True from the open until the scrim has finished fading after a landing.
    @Published private(set) var active = false
    /// The controlled value, for the reduced-motion crossfade.
    @Published private(set) var requested = false
    private(set) var last = MorphFrame()
    var onLanded: (() -> Void)?

    private var want = false
    private var phase = Phase.idle
    private var flight = Flight.still(MRect(x: 0, y: 0, w: 0, h: 0, r: 0), 0)
    private var from = MRect(x: 0, y: 0, w: 0, h: 0, r: 0)
    private var here = MRect(x: 0, y: 0, w: 0, h: 0, r: 0)
    private var target = MRect(x: 0, y: 0, w: 0, h: 0, r: 0)
    private var lock = false
    private var dim: (from: Double, t0: Double, d: Double, ease: Curve)?
    private var bg = 0.0
    private var lensAmp = 0.0
    private var ride = 0.0
    private var lastT = 0.0
    private var t0 = 0.0
    private var stamp = -1.0

    func present(_ open: Bool) {
        want = open
        if requested != open { requested = open }
        if open && !active { active = true }
    }

    /// Ends a reduced-motion close: the fade has finished.
    func finishReduced() {
        guard !want, active else { return }
        active = false
        onLanded?()
    }

    private func start(_ kind: (Double, Double), to: MRect, now: Double, sheet: Bool) {
        let t = now - flight.t0
        let fromR = flight.rect(t)
        let vel = flight.velocity(t)
        let k = weight(travel(fromR, to))
        flight = Flight(from: fromR, to: to, t0: now, d: lerp(kind.0, kind.1, k) / 1000, vel: vel, edge: sheet ? .top : leadingEdge(fromR, to), ease: Curve.at(k))
    }

    /// Advances the morph to `date` and returns the frame to draw. Idempotent per timestamp.
    func step(at date: Date, speed: Double, trigger triggerRect: CGRect, rest restRect: CGRect?, config c: MorphConfig) -> MorphFrame {
        let now = date.timeIntervalSinceReferenceDate * speed
        if now == stamp { return last }
        stamp = now
        let dt = min(0.1, max(0, now - lastT))
        lastT = now
        let trig = MRect(triggerRect, r: min(Double(c.triggerRadius), triggerRect.height / 2))
        let rest = restRect.map { MRect($0, r: Double(c.radius)) }
        let sheet = c.placement.isSheet

        // Section 5: react to the controlled value.
        if want && (phase == .idle || phase == .closing || phase == .landed) {
            if phase == .idle || phase == .landed { flight = .still(trig, now) }
            from = trig
            lock = false
            dim = nil
            phase = .opening
            t0 = now
        }
        if phase == .opening, let rest {
            start(K.open, to: rest, now: now, sheet: sheet)
            phase = .open
        }
        if !want && (phase == .open || phase == .opening) {
            here = rest ?? flight.rect(now - flight.t0)
            target = trig
            start(K.close, to: trig, now: now, sheet: sheet)
            dim = (bg, now, flight.d * K.tail, flight.ease)
            phase = .closing
            t0 = now
        }
        if phase == .open, lock, let rest {
            if !rest.sameSize(flight.to) {
                start(K.size, to: rest, now: now, sheet: sheet)
            } else if !rest.same(flight.to, 0.1), now - flight.t0 >= flight.d {
                flight = .still(rest, now)
            }
        }
        if phase == .closing, !trig.same(target, 0.25) {
            target = trig
            flight.to = trig
        }

        // Section 6: one frame.
        let t = now - flight.t0
        let done = t >= flight.d
        let R = flight.rect(t)
        let v = flight.velocity(t)
        var q = 0.0
        switch phase {
        case .opening: q = 0
        case .open:
            if let rest, !lock, done, R.same(rest, 0.5) { lock = true }
            q = lock ? 1 : ((rest.flatMap { progress(from, $0, R) }) ?? flight.eased(t))
        case .closing: q = progress(target, here, R) ?? 1 - flight.eased(t)
        case .idle, .landed: q = 0
        }

        var f = MorphFrame()
        f.q = q
        f.trigger = trig.cg
        let flowing = phase == .opening || phase == .open || phase == .closing
        if flowing {
            let goo = ramp(q, 0, K.gooSpan)
            // A 0.5 threshold keeps a blurred edge where it was, so no inset is needed.
            let edge = 0.0
            f.liquid = true
            f.goo = goo
            f.body = CGRect(x: R.x + edge, y: R.y + edge, width: max(0, R.w - 2 * edge), height: max(0, R.h - 2 * edge))
            f.bodyRadius = max(0, R.r - edge)
            f.clip = R
            let want = K.lens * (1 - exp(-abs(edgeSpeed(flight.edge, v)) / 2000))
            lensAmp += (want - lensAmp) * (1 - exp(-dt / K.lensTau))
            f.bulge = lensAmp * goo > 0.3 ? lens(on: flight.edge, R, inset: edge, amp: lensAmp * goo) : nil
            f.fill = c.fill.mixed(c.panel, ramp(q, 0.02, 0.4))

            let restW = phase == .closing ? here.w : (rest?.w ?? R.w)
            f.restWidth = restW
            f.fit = restW > 0 ? R.w / restW : 1
            let show = min(ramp(q, 0.3, 0.85), ramp(min(f.fit, 1 / max(f.fit, 0.0001)), 0.6, 0.9))
            ride = abs(show - ride) < 0.005 ? show : ride + (show - ride) * (1 - exp(-dt / K.fadeTau))
            f.ride = ride

            let gone = phase == .closing ? ramp(q, 0.02, 0.4) : ramp(q, 0, 0.25)
            f.labelOpacity = 1 - gone
            f.labelBlur = gone * K.labelBlur
            // SwiftUI can't copy the trigger's look, so the real trigger, under the liquid, takes over
            // while the liquid fits it (spec, end of section 6). It comes in fully before the liquid
            // fades off it, so the two never add up to a see-through, lighter frame.
            f.triggerOpacity = phase == .closing ? 1 - ramp(q, 0.004, 0.014) : 1 - ramp(q, 0.003, 0.01)
            f.liquidOpacity = ramp(q, 0, 0.004)
            f.interactive = phase == .open
        }

        if phase == .closing, (done && R.same(target, 1)) || now - t0 > K.landMax {
            phase = .landed
            f.liquid = false
            f.triggerOpacity = 1
            let landed = onLanded
            DispatchQueue.main.async { landed?() }
        }

        if phase == .opening || phase == .open || dim == nil {
            bg = q
        } else if let dim {
            bg = dim.from * (1 - dim.ease(clamp01((now - dim.t0) / dim.d)))
        }
        f.scrim = bg
        if phase == .landed, dim.map({ now - $0.t0 >= $0.d }) ?? true {
            phase = .idle
            f.scrim = 0
            DispatchQueue.main.async { [weak self] in
                guard let self, self.phase == .idle else { return }
                self.active = false
            }
        }
        if phase == .idle { f.triggerOpacity = 1 }
        last = f
        return f
    }
}

// MARK: - Views

struct MorphLayerItem: Identifiable {
    let id: ObjectIdentifier
    let anchor: Anchor<CGRect>
    let engine: MorphEngine
    let config: MorphConfig
    let content: AnyView
    let label: AnyView
    let dismiss: () -> Void
}

private struct MorphLayerKey: PreferenceKey {
    static var defaultValue: [MorphLayerItem] { [] }
    static func reduce(value: inout [MorphLayerItem], nextValue: () -> [MorphLayerItem]) { value.append(contentsOf: nextValue()) }
}

private struct MorphHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

@MainActor
final class MorphStage: ObservableObject {
    private var engines: [ObjectIdentifier: MorphEngine] = [:]
    func register(_ e: MorphEngine) { engines[ObjectIdentifier(e)] = e }
    var scrim: Double { engines.values.map(\.last.scrim).max() ?? 0 }
    var active: Bool { engines.values.contains { $0.active } }
}

private struct MorphStageKey: EnvironmentKey {
    static let defaultValue: MorphStage? = nil
}

extension EnvironmentValues {
    fileprivate var morphStage: MorphStage? {
        get { self[MorphStageKey.self] }
        set { self[MorphStageKey.self] = newValue }
    }
}

private struct MorphRootModifier: ViewModifier {
    @StateObject private var stage = MorphStage()
    @State private var warm = false

    func body(content: Content) -> some View {
        content
            .environment(\.morphStage, stage)
            .overlay(alignment: .topLeading) {
                // The first use of the blur and threshold filters stalls while the GPU builds them.
                // Run the chain once on a shape too faint to survive the threshold, so the first
                // morph starts without that stall.
                if !warm {
                    Canvas { ctx, _ in
                        ctx.addFilter(.shadow(color: .black.opacity(0.1), radius: 8, y: 4))
                        ctx.addFilter(.blur(radius: 0.5))
                        ctx.addFilter(.alphaThreshold(min: 0.5, color: .white))
                        ctx.addFilter(.blur(radius: K.blur))
                        ctx.drawLayer { $0.fill(Path(ellipseIn: CGRect(x: 16, y: 16, width: 32, height: 32)), with: .color(.white.opacity(0.3))) }
                    }
                    .frame(width: 64, height: 64)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                    .task {
                        try? await Task.sleep(nanoseconds: 600_000_000)
                        warm = true
                    }
                }
            }
            .overlayPreferenceValue(MorphLayerKey.self) { items in
                GeometryReader { proxy in
                    ZStack(alignment: .topLeading) {
                        ForEach(items) { item in
                            MorphLayer(item: item, engine: item.engine, trigger: proxy[item.anchor], root: proxy.size)
                        }
                    }
                    .frame(width: proxy.size.width, height: proxy.size.height, alignment: .topLeading)
                }
            }
    }
}

private struct MorphRecedeModifier: ViewModifier {
    let scale: CGFloat
    @Environment(\.morphStage) private var stage

    func body(content: Content) -> some View {
        TimelineView(.animation(paused: !(stage?.active ?? false))) { _ in
            content.scaleEffect(1 - (1 - scale) * (stage?.scrim ?? 0), anchor: .top)
        }
    }
}

private struct MorphTriggerModifier<Panel: View, Label: View>: ViewModifier {
    @Binding var isPresented: Bool
    let config: MorphConfig
    let onLanded: (() -> Void)?
    let panelContent: () -> Panel
    let label: () -> Label
    @StateObject private var engine = MorphEngine()
    @Environment(\.morphStage) private var stage
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let engine = engine
        TimelineView(.animation(paused: !engine.active)) { _ in
            content.opacity(reduceMotion ? 1 : engine.last.triggerOpacity)
        }
        .anchorPreference(key: MorphLayerKey.self, value: .bounds) { anchor in
            [MorphLayerItem(id: ObjectIdentifier(engine), anchor: anchor, engine: engine, config: config, content: AnyView(panelContent()), label: AnyView(label()), dismiss: { isPresented = false })]
        }
        .onAppear {
            stage?.register(engine)
            engine.onLanded = onLanded
            engine.present(isPresented)
        }
        .onChange(of: isPresented) { _, open in
            engine.onLanded = onLanded
            engine.present(open)
        }
    }
}

private struct MorphLayer: View {
    let item: MorphLayerItem
    @ObservedObject var engine: MorphEngine
    let trigger: CGRect
    let root: CGSize
    @State private var contentHeight: CGFloat = 0
    @Environment(\.liquidMorphSpeed) private var speed
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var config: MorphConfig { item.config }

    var body: some View {
        if reduceMotion, engine.active {
            ReducedMorphLayer(item: item, engine: engine, root: root, contentHeight: $contentHeight)
        } else if engine.active {
            TimelineView(.animation) { timeline in
                let rest = restRect
                let f = engine.step(at: timeline.date, speed: speed, trigger: trigger, rest: rest, config: config)
                ZStack(alignment: .topLeading) {
                    if let scrim = config.scrim {
                        scrim
                            .opacity(f.scrim)
                            .contentShape(Rectangle())
                            .onTapGesture { item.dismiss() }
                            .allowsHitTesting(f.interactive)
                    }
                    if f.liquid {
                        goo(f)
                        panel(f, rest: rest)
                    }
                }
                .frame(width: root.width, height: root.height, alignment: .topLeading)
                .onPreferenceChange(MorphHeightKey.self) { contentHeight = $0 }
            }
        }
    }

    private var restRect: CGRect? {
        let r = config.placement.rect(in: root, contentHeight: contentHeight)
        return config.placement.fixesHeight || contentHeight > 0 ? r : nil
    }

    private func goo(_ f: MorphFrame) -> some View {
        Canvas { ctx, _ in
            if let s = config.shadow, f.q > 0.001 {
                ctx.addFilter(.shadow(color: s.color.opacity(f.q), radius: s.radius * f.q, x: s.x * f.q, y: s.y * f.q))
            }
            // Filters run last-added first: blur, then threshold, then a hairline blur that smooths the
            // threshold's hard edge. SwiftUI's colour matrix doesn't clamp alpha, so the web version's
            // contrast matrix can't be used here; at rest the goo is skipped and the shape is exact.
            if f.goo > 0.001 {
                ctx.addFilter(.blur(radius: 0.5))
                ctx.addFilter(.alphaThreshold(min: 0.5, color: f.fill.color))
                ctx.addFilter(.blur(radius: K.blur * f.goo))
            }
            ctx.drawLayer { layer in
                let color = f.fill.color
                layer.fill(Path(roundedRect: f.body, cornerRadius: f.bodyRadius, style: .circular), with: .color(color))
                if let bulge = f.bulge { layer.fill(Path(ellipseIn: bulge), with: .color(color)) }
            }
        }
        .opacity(f.liquidOpacity)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func panel(_ f: MorphFrame, rest: CGRect?) -> some View {
        ZStack(alignment: .topLeading) {
            item.content
                .frame(width: f.restWidth, alignment: .topLeading)
                .fixedSize(horizontal: false, vertical: true)
                .background(GeometryReader { g in Color.clear.preference(key: MorphHeightKey.self, value: g.size.height) })
                .scaleEffect(f.fit, anchor: .topLeading)
                .blur(radius: (1 - f.ride) * K.contentBlur)
                .opacity(f.ride)
                .offset(x: f.clip.x, y: f.clip.y)
                .allowsHitTesting(f.interactive)
            item.label
                .frame(width: f.trigger.width, height: f.trigger.height)
                .blur(radius: f.labelBlur)
                .opacity(f.labelOpacity)
                .offset(x: f.trigger.minX, y: f.trigger.minY)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
        }
        .frame(width: root.width, height: root.height, alignment: .topLeading)
        .clipShape(LiquidClip(rect: f.clip))
    }
}

/// The liquid's rounded rect, as a clip for the panel's content.
private struct LiquidClip: Shape {
    var rect: MRect
    func path(in _: CGRect) -> Path {
        Path(roundedRect: rect.cg, cornerRadius: rect.r, style: .circular)
    }
}

/// Reduced motion: a 200 ms crossfade of the panel and scrim at their resting place.
private struct ReducedMorphLayer: View {
    let item: MorphLayerItem
    @ObservedObject var engine: MorphEngine
    let root: CGSize
    @Binding var contentHeight: CGFloat
    @State private var shown = false

    var body: some View {
        let rect = item.config.placement.rect(in: root, contentHeight: contentHeight)
        ZStack(alignment: .topLeading) {
            if let scrim = item.config.scrim {
                scrim.opacity(shown ? 1 : 0).onTapGesture { item.dismiss() }.allowsHitTesting(shown)
            }
            item.content
                .frame(width: rect.width, alignment: .topLeading)
                .fixedSize(horizontal: false, vertical: true)
                .background(GeometryReader { g in Color.clear.preference(key: MorphHeightKey.self, value: g.size.height) })
                .background(item.config.panelColor)
                .clipShape(RoundedRectangle(cornerRadius: item.config.radius, style: .circular))
                .offset(x: rect.minX, y: rect.minY)
                .opacity(shown ? 1 : 0)
                .allowsHitTesting(shown)
        }
        .frame(width: root.width, height: root.height, alignment: .topLeading)
        .onPreferenceChange(MorphHeightKey.self) { contentHeight = $0 }
        .onReceive(engine.$requested) { open in
            withAnimation(.easeInOut(duration: K.fade)) { shown = open }
            if !open, engine.active {
                DispatchQueue.main.asyncAfter(deadline: .now() + K.fade) { engine.finishReduced() }
            }
        }
    }
}
