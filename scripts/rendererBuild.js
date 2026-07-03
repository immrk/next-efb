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

function buildWindow(name) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('npx', ['vite', 'build'], {
      cwd: root,
      env: { ...process.env, WINDOW_NAME: name },
      stdio: 'inherit',
      shell: true
    })
    child.on('exit', (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`Renderer build failed for window "${name}" (${code})`))
    )
    child.on('error', reject)
  })
}

const windows = await loadWindowConfig()
const onlyArgument = process.argv.find((argument) => argument.startsWith('--only='))
const selectedWindows = onlyArgument ? onlyArgument.split('=')[1].split(',') : Object.keys(windows)
const validWindows = selectedWindows.filter((name) => windows[name])

await Promise.all(validWindows.map(buildWindow))
console.log(`Built renderer windows: ${validWindows.join(', ')}`)
