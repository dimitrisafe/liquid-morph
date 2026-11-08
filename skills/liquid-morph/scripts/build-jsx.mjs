#!/usr/bin/env node
// Regenerates assets/liquid-morph.jsx from assets/liquid-morph.tsx (types stripped, JSX kept).
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')
const run = spawnSync('npx', ['--yes', 'esbuild@0.28.2', join(assets, 'liquid-morph.tsx'), '--loader:.tsx=tsx', '--jsx=preserve', '--format=esm', '--log-level=warning'], { encoding: 'utf8' })
if (run.status !== 0) {
  console.error(run.stderr)
  process.exit(1)
}
writeFileSync(join(assets, 'liquid-morph.jsx'), `// Generated from liquid-morph.tsx with esbuild --jsx=preserve. Edit the .tsx, then regenerate.\n${run.stdout}`)
console.log('assets/liquid-morph.jsx regenerated')
