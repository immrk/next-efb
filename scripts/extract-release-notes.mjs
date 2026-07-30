#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const packageJson = JSON.parse(
  readFileSync(resolve(projectRoot, 'package.json'), 'utf8')
)
const version = packageJson.version
const outputArgumentIndex = process.argv.indexOf('--output')
const outputPath = resolve(
  projectRoot,
  outputArgumentIndex >= 0 && process.argv[outputArgumentIndex + 1]
    ? process.argv[outputArgumentIndex + 1]
    : 'release-notes.md'
)

let notes = ''
try {
  const changelog = readFileSync(resolve(projectRoot, 'CHANGELOG.md'), 'utf8')
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const section = changelog.match(
    new RegExp(`(?:^|\\r?\\n)## ${escapedVersion}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`)
  )
  notes = section?.[1]?.trim() ?? ''
} catch {
  notes = ''
}

const body = notes || 'See the merged changes included in this release.'
writeFileSync(
  outputPath,
  `# NextEFB v${version}\n\n${body}\n`,
  'utf8'
)
console.log(`Release notes written to ${outputPath}`)
