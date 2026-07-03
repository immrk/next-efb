#!/usr/bin/env node
import 'dotenv/config'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const projectRoot = resolve(dirname(__filename), '..')

execSync('npm run tsup', {
  cwd: projectRoot,
  stdio: 'inherit',
  encoding: 'utf8'
})
