#!/usr/bin/env node
// Copies the liquid-morph engine into a React project and reports what the project has.
// Usage: node install.mjs [project-dir] [--dest <dir>] [--force]
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const fail = (message) => {
  console.error(`liquid-morph: ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const option = (name) => {
  const i = args.indexOf(name)
  return i < 0 ? undefined : args.splice(i, 2)[1]
}
const dest = option('--dest')
const force = args.includes('--force')
const project = resolve(args.find((a) => !a.startsWith('--')) ?? '.')
const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets')

const pkgFile = join(project, 'package.json')
if (!existsSync(pkgFile)) fail(`no package.json in ${project}`)
const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
const declared = { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies }
const version = (name) => {
  try {
    return JSON.parse(readFileSync(join(project, 'node_modules', name, 'package.json'), 'utf8')).version
  } catch {
    return declared[name] ?? null
  }
}

const react = version('react')
if (!react || !version('react-dom')) fail('react and react-dom are not installed, so this is not a React DOM project. Follow references/spec.md and the guide for its framework instead.')
if (parseInt(String(react).replace(/^\D*/, ''), 10) < 18) fail(`react ${react} is installed; the engine needs React 18 or newer.`)

const next = Boolean(declared.next)
const typescript = existsSync(join(project, 'tsconfig.json'))
const dir = resolve(project, dest ?? (['src/components', 'components', 'app/components'].find((d) => existsSync(join(project, d))) ?? (existsSync(join(project, 'src')) ? 'src/components' : 'components')))
const file = join(dir, typescript ? 'liquid-morph.tsx' : 'liquid-morph.jsx')

let body = readFileSync(join(assets, typescript ? 'liquid-morph.tsx' : 'liquid-morph.jsx'), 'utf8')
if (!next) body = body.replace(/^((?:\/\/.*\n)*)["']use client["'];?\n/, '$1')

// The stamp is a hash of the body it was installed with, so an unedited copy can be
// updated in place while an edited one is left alone.
const STAMP = /^\/\/ liquid-morph ([0-9a-f]{12})\b.*\n/
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 12)
const source = `// liquid-morph ${hash(body)}. Installed by the liquid-morph skill; reinstalling replaces this file only while it is unedited.\n${body}`

const current = existsSync(file) ? readFileSync(file, 'utf8') : null
const stamp = current && STAMP.exec(current)
const unedited = Boolean(stamp && hash(current.slice(stamp[0].length)) === stamp[1])
if (current !== null && current !== source && !unedited && !force) fail(`${relative(project, file)} was edited after it was installed (or predates the installer). Diff it against ${join(assets, typescript ? 'liquid-morph.tsx' : 'liquid-morph.jsx')}, then rerun with --force to replace it.`)
const status = current === null ? 'installed' : current === source ? 'up to date' : unedited ? 'updated' : 'replaced'
if (status !== 'up to date') {
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, source)
}

console.log(
  JSON.stringify(
    {
      status,
      file: relative(project, file),
      react,
      framework: next ? 'next' : declared.vite ? 'vite' : 'react',
      typescript,
      motion: declared.motion ?? declared['framer-motion'] ?? null,
      tailwind: declared.tailwindcss ?? null,
    },
    null,
    2,
  ),
)
