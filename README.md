# Liquid morph

A Claude Code skill that makes one element pour into another, and back, on the web, iOS or Android. A button pours into the sheet it opens. A sidebar toggle pours into the sidebar, and an avatar into its menu. When the panel closes, it pours back and lands exactly on the button it came from.

You describe what should open. The skill brings the engine for your platform and wires it up.

See it in motion: [dimitrisafentakis.com/skills/liquid-morph](https://www.dimitrisafentakis.com/skills/liquid-morph)

## What it can do

- A button into a bottom sheet, modal or composer
- A sidebar toggle into a sidebar
- An avatar or menu pill into a dropdown or nav
- A search icon into a search panel
- A status pill into a picker
- A pill of tool icons into a formatting, voice or time bar
- An "Add to bag" button into a quantity stepper
- A now-playing card into a mini player

## Platforms

| Platform | What the skill uses |
| --- | --- |
| React, Next.js, Vite | A one-file engine, installed into your project by a script |
| SwiftUI (iOS 17+) | A one-file Swift engine you drop into the app target |
| UIKit | The SwiftUI engine in a hosting controller, or a port of the spec |
| Jetpack Compose, Compose Multiplatform, Kotlin Multiplatform | A port of the spec, with a Compose guide for the clock, measuring and the goo effect |
| Flutter, React Native, Vue, Svelte and the rest | A port of the spec, with notes for each |

Every version follows the same spec (`skills/liquid-morph/references/spec.md`): the same constants, timing and landing behaviour. A port should look the same as the original.

## Install

```bash
npx skills add dimitrisafe/liquid-morph
```

<details>
<summary>Other ways to install</summary>

As a Claude Code plugin:

```
/plugin marketplace add dimitrisafe/liquid-morph
/plugin install liquid-morph@liquid-morph
```

By hand:

```bash
git clone https://github.com/dimitrisafe/liquid-morph.git
cp -R liquid-morph/skills/liquid-morph ~/.claude/skills/
```

</details>

## Use it

Ask in plain words, in any project. For example:

> Make the sidebar open from the toggle with the liquid morph.

> Turn the Add to bag button into a quantity stepper with a liquid morph.

> The avatar should pour into the account menu.

Nothing is installed from a package manager. On the web, Claude copies `liquid-morph.tsx` (or `.jsx`) into your components folder. On iOS, it adds `LiquidMorph.swift` to your target. On other platforms, it ports the spec into your code.

## How it moves

- **Size sets the timing.** A small picker opens in about 220 ms, a menu in about 270, and a full sheet or sidebar in 300 to 340. Closing is a little quicker than opening.
- **Size sets the curve.** Short moves ease gently. Long ones front-load their motion, so the extra time reads as weight rather than lag.
- **Nothing grows from a speck.** Content shows only once it is near its full size, and resolves from a light blur.
- **It lands exactly.** The liquid settles into the trigger's own shape and colour, so the button is back where it was, ring, gradient and all.
- **It can change its mind.** Closing while it is still opening reverses smoothly from where it is.
- **It respects reduced motion.** With reduced motion turned on, the morph becomes a short fade.

## What's in the repo

```
.claude-plugin/                 plugin and marketplace manifests
skills/liquid-morph/
  SKILL.md                      the core rules, recipes and platform routing
  references/spec.md            the platform-neutral engine spec
  references/react.md           React, Next.js and Vite
  references/swiftui.md         SwiftUI and UIKit
  references/compose.md         Jetpack Compose, Compose Multiplatform, Kotlin Multiplatform
  references/other-platforms.md Flutter, React Native, other web frameworks
  assets/liquid-morph.tsx       the React engine (and a generated .jsx)
  assets/swiftui/               the SwiftUI engine
  scripts/install.mjs           copies the React engine into a project
  scripts/build-jsx.mjs         regenerates the JavaScript copy after edits
```

## License

MIT. Made by [Dimitris Afentakis](https://www.dimitrisafentakis.com).
