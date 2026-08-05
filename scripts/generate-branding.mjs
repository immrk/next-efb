import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const brandingDir = resolve(__dirname, '../assets/branding')
const sourceImagePath = resolve(brandingDir, 'source/NextEFBIcon.png')
const iconSizes = [16, 32, 48, 64, 128, 180, 192, 256, 512]

if (!existsSync(sourceImagePath)) {
  throw new Error(`Missing branding source image: ${sourceImagePath}`)
}

mkdirSync(brandingDir, { recursive: true })

for (const staleFile of ['brand-mark.svg', 'favicon.svg']) {
  const stalePath = resolve(brandingDir, staleFile)
  if (existsSync(stalePath)) {
    rmSync(stalePath, { force: true })
  }
}

const pngBuffers = new Map()
for (const size of iconSizes) {
  const outputPath = resolve(brandingDir, `icon-${size}.png`)
  generatePngVariant(size, outputPath)
  pngBuffers.set(size, readFileSync(outputPath))
}

copyFileSync(resolve(brandingDir, 'icon-32.png'), resolve(brandingDir, 'tray-icon-32.png'))
copyFileSync(resolve(brandingDir, 'icon-256.png'), resolve(brandingDir, 'app-icon-256.png'))
copyFileSync(resolve(brandingDir, 'icon-256.png'), resolve(brandingDir, 'brand-mark.png'))
copyFileSync(resolve(brandingDir, 'icon-180.png'), resolve(brandingDir, 'apple-touch-icon.png'))

writeFileSync(resolve(brandingDir, 'favicon.ico'), createIco([16, 32, 48], pngBuffers))
writeFileSync(resolve(brandingDir, 'NextEFB.ico'), createIco([16, 32, 48, 64, 128, 256], pngBuffers))
writeFileSync(
  resolve(brandingDir, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'NextEFB',
      short_name: 'NextEFB',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#1783ef',
      icons: [
        { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: './icon-512.png', sizes: '512x512', type: 'image/png' }
      ]
    },
    null,
    2
  )
)
writeFileSync(
  resolve(brandingDir, 'README.md'),
  [
    '# NextEFB Branding',
    '',
    'This directory is generated from `assets/branding/source/NextEFBIcon.png`.',
    '',
    '- `brand-mark.png`: UI branding image used in the renderer',
    '- `icon-*.png`: generated raster sizes for web and desktop use',
    '- `NextEFB.ico`: Windows application and installer icon',
    '- `tray-icon-32.png`: system tray icon',
    '',
    'Regenerate everything with:',
    '',
    '```bash',
    'npm run branding:generate',
    '```',
    ''
  ].join('\n')
)

function generatePngVariant(size, outputPath) {
  const script = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${escapeForPowerShell(sourceImagePath)}')
try {
  $bitmap = New-Object System.Drawing.Bitmap ${size}, ${size}
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::White)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.DrawImage($src, 0, 0, ${size}, ${size})
      $bitmap.Save('${escapeForPowerShell(outputPath)}', [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
    }
  } finally {
    $bitmap.Dispose()
  }
} finally {
  $src.Dispose()
}
`

  const result = spawnSync('powershell', ['-NoProfile', '-Command', script], {
    stdio: 'pipe',
    encoding: 'utf8'
  })

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to generate ${outputPath}`)
  }
}

function escapeForPowerShell(value) {
  return value.replace(/'/g, "''")
}

function createIco(sizes, pngBuffers) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)

  const entries = []
  const images = []
  let offset = 6 + sizes.length * 16

  for (const size of sizes) {
    const png = pngBuffers.get(size)
    const entry = Buffer.alloc(16)
    entry[0] = size >= 256 ? 0 : size
    entry[1] = size >= 256 ? 0 : size
    entry[2] = 0
    entry[3] = 0
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(png.length, 8)
    entry.writeUInt32LE(offset, 12)
    entries.push(entry)
    images.push(png)
    offset += png.length
  }

  return Buffer.concat([header, ...entries, ...images])
}
