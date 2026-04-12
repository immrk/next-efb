import type { ChartFileFormat, PickedChartFile } from '@shared/chart-types'

const CONTENT_TYPE_FORMAT_MAP: Record<string, ChartFileFormat> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png'
}

export class RemoteChartImportService {
  async download(url: string): Promise<PickedChartFile> {
    const normalizedUrl = parseRemoteUrl(url)
    const response = await fetch(normalizedUrl.toString(), {
      redirect: 'follow'
    })

    if (!response.ok) {
      throw new Error(`REMOTE_DOWNLOAD_FAILED:${response.status}`)
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0) {
      throw new Error('REMOTE_FILE_EMPTY')
    }

    const contentType = normalizeContentType(response.headers.get('content-type'))
    const fileNameFromHeader = extractFileNameFromContentDisposition(
      response.headers.get('content-disposition')
    )
    const finalUrl = new URL(response.url || normalizedUrl.toString())
    const fileFormat =
      detectFileFormatFromBytes(bytes) ??
      inferFileFormat(fileNameFromHeader) ??
      inferFileFormat(finalUrl.pathname) ??
      inferFileFormatFromContentType(contentType)

    if (!fileFormat) {
      throw new Error('REMOTE_FILE_TYPE_UNSUPPORTED')
    }

    const fileName = ensureFileName(
      fileNameFromHeader ?? extractFileNameFromPath(finalUrl.pathname) ?? 'chart',
      fileFormat
    )

    return {
      sourcePath: null,
      fileName,
      fileFormat,
      mimeType: getMimeTypeByFormat(fileFormat),
      base64: bytes.toString('base64')
    }
  }
}

function parseRemoteUrl(value: string): URL {
  let parsed: URL

  try {
    parsed = new URL(value.trim())
  } catch {
    throw new Error('REMOTE_URL_INVALID')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('REMOTE_URL_INVALID')
  }

  return parsed
}

function normalizeContentType(value: string | null): string | null {
  if (!value) {
    return null
  }

  return value.split(';')[0]?.trim().toLowerCase() ?? null
}

function inferFileFormat(source: string | null | undefined): ChartFileFormat | null {
  if (!source) {
    return null
  }

  const normalized = source.toLowerCase()
  if (normalized.endsWith('.pdf')) return 'pdf'
  if (normalized.endsWith('.png')) return 'png'
  if (normalized.endsWith('.jpg')) return 'jpg'
  if (normalized.endsWith('.jpeg')) return 'jpeg'
  return null
}

function inferFileFormatFromContentType(contentType: string | null): ChartFileFormat | null {
  if (!contentType) {
    return null
  }

  return CONTENT_TYPE_FORMAT_MAP[contentType] ?? null
}

function detectFileFormatFromBytes(bytes: Buffer): ChartFileFormat | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'pdf'
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'png'
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg'
  }

  return null
}

function extractFileNameFromContentDisposition(value: string | null): string | null {
  if (!value) {
    return null
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    return sanitizeFileName(decodeURIComponent(utf8Match[1]))
  }

  const basicMatch = value.match(/filename="?([^";]+)"?/i)
  if (basicMatch?.[1]) {
    return sanitizeFileName(basicMatch[1])
  }

  return null
}

function extractFileNameFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean)
  const lastSegment = segments.at(-1)
  if (!lastSegment) {
    return null
  }

  return sanitizeFileName(decodeURIComponent(lastSegment))
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim()
}

function ensureFileName(fileName: string, fileFormat: ChartFileFormat): string {
  const normalized = sanitizeFileName(fileName) || 'chart'
  if (inferFileFormat(normalized)) {
    return normalized
  }

  const extension = fileFormat === 'jpeg' ? 'jpg' : fileFormat
  return `${normalized}.${extension}`
}

function getMimeTypeByFormat(fileFormat: ChartFileFormat): string {
  switch (fileFormat) {
    case 'pdf':
      return 'application/pdf'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
    default:
      return 'image/png'
  }
}
