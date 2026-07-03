#!/usr/bin/env node
import 'dotenv/config'
import { spawn, exec as execCallback } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdir, stat } from 'node:fs/promises'
import { promisify } from 'node:util'

const exec = promisify(execCallback)
const __filename = fileURLToPath(import.meta.url)
const root = resolve(dirname(__filename), '..')
const cacheDir = resolve(root, '.cache')
const cacheFile = resolve(cacheDir, 'windowConfig.mjs')
const children = new Set()

async function loadWindowConfig() {
  const source = resolve(root, 'src/config/windowConfig.ts')
  await mkdir(cacheDir, { recursive: true })

  let needsBuild = true
  try {
    const [sourceStat, cacheStat] = await Promise.all([stat(source), stat(cacheFile)])
    needsBuild = sourceStat.mtimeMs > cacheStat.mtimeMs
  } catch {
    // The first run always compiles the cache.
  }

  if (needsBuild) {
    await exec(
      `npx esbuild "${source}" --bundle --format=esm --platform=node --outfile="${cacheFile}" --log-level=error`
    )
  }

  const { WINDOW_LIST } = await import(`${pathToFileURL(cacheFile).href}?t=${Date.now()}`)
  return WINDOW_LIST
}

function startVite(name, { devPort }) {
  const child = spawn('npx', ['vite', '--mode', 'renderer'], {
    cwd: root,
    env: { ...process.env, WINDOW_NAME: name, PORT: String(devPort) },
    stdio: 'inherit',
    shell: true
  })
  children.add(child)
  return child
}

function startMock() {
  const child = spawn('npx', ['vite', '--mode', 'mock'], {
    cwd: root,
    stdio: 'inherit',
    shell: true
  })
  children.add(child)
}

function cleanup(signal) {
  for (const child of children) child.kill('SIGTERM')
  if (signal) process.exit()
}

process.on('SIGINT', () => cleanup('SIGINT'))
process.on('SIGTERM', () => cleanup('SIGTERM'))
process.on('exit', () => cleanup())

const windows = await loadWindowConfig()
const onlyArgument = process.argv.find((argument) => argument.startsWith('--only='))
const selectedWindows = onlyArgument ? onlyArgument.split('=')[1].split(',') : null

for (const [name, config] of Object.entries(windows)) {
  if (!selectedWindows || selectedWindows.includes(name)) startVite(name, config)
}

if (process.env.VITE_MOCK === 'true') startMock()

console.log('NextEFB renderer development servers:')
for (const [name, config] of Object.entries(windows)) {
  if (!selectedWindows || selectedWindows.includes(name)) {
    console.log(`  ${name}: http://localhost:${config.devPort}`)
  }
}
