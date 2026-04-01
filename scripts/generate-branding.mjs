import { mkdirSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const brandingDir = resolve(__dirname, '../assets/branding')

const palette = {
  deep: [7, 17, 28],
  mid: [14, 42, 70],
  bright: [83, 225, 255],
  stroke: [216, 245, 255],
  glow: [61, 227, 255]
}

const iconSizes = [16, 32, 48, 64, 128, 180, 192, 256, 512]

mkdirSync(brandingDir, { recursive: true })

writeFileSync(resolve(brandingDir, 'brand-mark.svg'), createSvg())
writeFileSync(resolve(brandingDir, 'favicon.svg'), createSvg({ includeWordmark: false }))

const pngBuffers = new Map()
for (const size of iconSizes) {
  const png = createPng(size, size, renderIcon(size))
  pngBuffers.set(size, png)
  writeFileSync(resolve(brandingDir, `icon-${size}.png`), png)
}

copyFileSync(resolve(brandingDir, 'icon-32.png'), resolve(brandingDir, 'tray-icon-32.png'))
copyFileSync(resolve(brandingDir, 'icon-256.png'), resolve(brandingDir, 'app-icon-256.png'))
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
      background_color: '#08131f',
      theme_color: '#08131f',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
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
    'This directory is the single source of truth for app branding assets.',
    '',
    '- `brand-mark.svg`: vector source used by the desktop UI and website favicon flow',
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

function createSvg({ includeWordmark = true } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="${includeWordmark ? '512' : '256'}" viewBox="0 0 512 ${includeWordmark ? '512' : '256'}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="72" y1="36" x2="436" y2="436" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0E3658"/>
      <stop offset="1" stop-color="#07111C"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(156 124) rotate(42) scale(228 220)">
      <stop stop-color="#53E1FF" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#53E1FF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hex" x1="128" y1="76" x2="384" y2="356" gradientUnits="userSpaceOnUse">
      <stop stop-color="#B9F3FF"/>
      <stop offset="1" stop-color="#53E1FF"/>
    </linearGradient>
  </defs>
  <rect x="28" y="28" width="456" height="456" rx="128" fill="url(#bg)"/>
  <rect x="28" y="28" width="456" height="456" rx="128" fill="url(#glow)"/>
  <path d="M256 88L374 156V292L256 360L138 292V156L256 88Z" fill="#113251" fill-opacity="0.52"/>
  <path d="M256 88L374 156V292L256 360L138 292V156L256 88Z" stroke="url(#hex)" stroke-width="22" stroke-linejoin="round"/>
  <path d="M188 302V146L324 302V146" stroke="#53E1FF" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M188 302V146L324 302V146" stroke="#BFF7FF" stroke-opacity="0.38" stroke-width="62" stroke-linecap="round" stroke-linejoin="round"/>
  ${
    includeWordmark
      ? '<text x="256" y="458" text-anchor="middle" fill="#EAFBFF" font-size="64" font-family="Segoe UI, Arial, sans-serif" font-weight="700" letter-spacing="8">NextEFB</text>'
      : ''
  }
</svg>`
}

function renderIcon(size) {
  const radius = 0.25
  const hex = [
    [0.5, 0.17],
    [0.73, 0.305],
    [0.73, 0.57],
    [0.5, 0.705],
    [0.27, 0.57],
    [0.27, 0.305]
  ]
  const nPath = [
    [0.367, 0.59],
    [0.367, 0.285],
    [0.633, 0.59],
    [0.633, 0.285]
  ]

  return (x, y) => {
    const u = (x + 0.5) / size
    const v = (y + 0.5) / size

    let color = [0, 0, 0, 0]
    const bgAlpha = insideRoundedRect(u, v, radius) ? 1 : 0
    if (bgAlpha > 0) {
      const base = mix(palette.deep, palette.mid, clamp(v * 0.92 + 0.08, 0, 1))
      const glow = radialGlow(u, v, 0.28, 0.24, 0.44)
      const topSheen = radialGlow(u, v, 0.52, 0.2, 0.34)
      color = blend(color, [...mix(base, palette.bright, glow * 0.42), bgAlpha])
      color = blend(color, [...mix(base, palette.stroke, topSheen * 0.12), topSheen * 0.22])
    }

    const hexFill = polygonContains(hex, u, v) ? 0.34 : 0
    if (hexFill > 0) {
      color = blend(color, [17, 50, 81, hexFill])
    }

    const hexOuter = minDistanceToPolyline(hex, u, v, true)
    if (hexOuter <= 0.024) {
      const t = clamp(1 - hexOuter / 0.024, 0, 1)
      color = blend(color, [...mix(palette.stroke, palette.bright, 0.35), t])
    }

    const nGlow = minDistanceToPolyline(nPath, u, v, false)
    if (nGlow <= 0.065) {
      const t = clamp(1 - nGlow / 0.065, 0, 1)
      color = blend(color, [191, 247, 255, t * 0.38])
    }

    if (nGlow <= 0.038) {
      const t = clamp(1 - nGlow / 0.038, 0, 1)
      color = blend(color, [...palette.glow, t])
    }

    return color
  }
}

function createPng(width, height, sampler) {
  const raw = Buffer.alloc(height * (1 + width * 4))
  let offset = 0

  for (let y = 0; y < height; y += 1) {
    raw[offset++] = 0
    for (let x = 0; x < width; x += 1) {
      const rgba = samplePixel(sampler, x, y)
      raw[offset++] = rgba[0]
      raw[offset++] = rgba[1]
      raw[offset++] = rgba[2]
      raw[offset++] = rgba[3]
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
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

function samplePixel(sampler, px, py) {
  const samples = 4
  let out = [0, 0, 0, 0]
  for (let sy = 0; sy < samples; sy += 1) {
    for (let sx = 0; sx < samples; sx += 1) {
      const x = px + (sx + 0.5) / samples
      const y = py + (sy + 0.5) / samples
      out = blend(out, sampler(x, y))
    }
  }

  return [
    Math.round(out[0]),
    Math.round(out[1]),
    Math.round(out[2]),
    Math.round(clamp(out[3], 0, 1) * 255)
  ]
}

function insideRoundedRect(x, y, radius) {
  const qx = Math.abs(x - 0.5) - (0.5 - radius)
  const qy = Math.abs(y - 0.5) - (0.5 - radius)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.sqrt(ax * ax + ay * ay) - radius <= 0
}

function polygonContains(points, x, y) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0]
    const yi = points[i][1]
    const xj = points[j][0]
    const yj = points[j][1]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function minDistanceToPolyline(points, x, y, closed) {
  let best = Number.POSITIVE_INFINITY
  for (let i = 0; i < points.length - 1; i += 1) {
    best = Math.min(best, pointSegmentDistance(x, y, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]))
  }
  if (closed) {
    best = Math.min(
      best,
      pointSegmentDistance(x, y, points[points.length - 1][0], points[points.length - 1][1], points[0][0], points[0][1])
    )
  }
  return best
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const denom = abx * abx + aby * aby
  const t = denom === 0 ? 0 : clamp((apx * abx + apy * aby) / denom, 0, 1)
  const dx = ax + abx * t - px
  const dy = ay + aby * t - py
  return Math.sqrt(dx * dx + dy * dy)
}

function radialGlow(x, y, cx, cy, radius) {
  const dx = x - cx
  const dy = y - cy
  const d = Math.sqrt(dx * dx + dy * dy)
  return clamp(1 - d / radius, 0, 1)
}

function blend(base, top) {
  const baseAlpha = clamp(base[3], 0, 1)
  const topAlpha = clamp((top[3] ?? 0), 0, 1)
  const outAlpha = topAlpha + baseAlpha * (1 - topAlpha)
  if (outAlpha <= 0) {
    return [0, 0, 0, 0]
  }

  return [
    ((top[0] ?? 0) * topAlpha + (base[0] ?? 0) * baseAlpha * (1 - topAlpha)) / outAlpha,
    ((top[1] ?? 0) * topAlpha + (base[1] ?? 0) * baseAlpha * (1 - topAlpha)) / outAlpha,
    ((top[2] ?? 0) * topAlpha + (base[2] ?? 0) * baseAlpha * (1 - topAlpha)) / outAlpha,
    outAlpha
  ]
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ]
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
