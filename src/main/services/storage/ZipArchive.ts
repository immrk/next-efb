import { deflateRawSync, inflateRawSync } from 'node:zlib'

const LOCAL_FILE_SIGNATURE = 0x04034b50
const CENTRAL_FILE_SIGNATURE = 0x02014b50
const END_SIGNATURE = 0x06054b50
const UTF8_FLAG = 0x0800
const MAX_EOCD_SEARCH = 65_557

export interface ZipArchiveEntry {
  name: string
  data: Buffer
}

export interface ZipReadLimits {
  maxEntries: number
  maxEntrySize: number
  maxTotalSize: number
}

export function createZipArchive(entries: ZipArchiveEntry[]): Buffer {
  if (entries.length > 65_535) {
    throw new Error('CHART_BUNDLE_TOO_MANY_ENTRIES')
  }

  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let localOffset = 0

  for (const entry of entries) {
    validateEntryName(entry.name)
    const name = Buffer.from(entry.name, 'utf8')
    const compressed = deflateRawSync(entry.data, { level: 9 })
    const checksum = crc32(entry.data)
    assertUInt32(entry.data.length)
    assertUInt32(compressed.length)
    assertUInt32(localOffset)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(LOCAL_FILE_SIGNATURE, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(UTF8_FLAG, 6)
    localHeader.writeUInt16LE(8, 8)
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(checksum, 14)
    localHeader.writeUInt32LE(compressed.length, 18)
    localHeader.writeUInt32LE(entry.data.length, 22)
    localHeader.writeUInt16LE(name.length, 26)
    localHeader.writeUInt16LE(0, 28)
    localParts.push(localHeader, name, compressed)

    const centralHeader = Buffer.alloc(46)
    centralHeader.writeUInt32LE(CENTRAL_FILE_SIGNATURE, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(UTF8_FLAG, 8)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(checksum, 16)
    centralHeader.writeUInt32LE(compressed.length, 20)
    centralHeader.writeUInt32LE(entry.data.length, 24)
    centralHeader.writeUInt16LE(name.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(localOffset, 42)
    centralParts.push(centralHeader, name)

    localOffset += localHeader.length + name.length + compressed.length
  }

  const centralDirectory = Buffer.concat(centralParts)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_SIGNATURE, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(localOffset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDirectory, end])
}

export function readZipArchive(
  archive: Buffer,
  limits: ZipReadLimits
): Map<string, Buffer> {
  const eocdOffset = findEndOfCentralDirectory(archive)
  if (eocdOffset < 0) {
    throw new Error('CHART_BUNDLE_ZIP_INVALID')
  }

  const diskNumber = archive.readUInt16LE(eocdOffset + 4)
  const centralDisk = archive.readUInt16LE(eocdOffset + 6)
  const entryCount = archive.readUInt16LE(eocdOffset + 10)
  const centralSize = archive.readUInt32LE(eocdOffset + 12)
  const centralOffset = archive.readUInt32LE(eocdOffset + 16)
  if (diskNumber !== 0 || centralDisk !== 0) {
    throw new Error('CHART_BUNDLE_MULTIDISK_UNSUPPORTED')
  }
  if (entryCount > limits.maxEntries) {
    throw new Error('CHART_BUNDLE_TOO_MANY_ENTRIES')
  }
  if (centralOffset + centralSize > archive.length) {
    throw new Error('CHART_BUNDLE_ZIP_INVALID')
  }

  const descriptors: Array<{
    name: string
    flags: number
    compression: number
    checksum: number
    compressedSize: number
    uncompressedSize: number
    localOffset: number
  }> = []
  const names = new Set<string>()
  let cursor = centralOffset
  let totalSize = 0

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== CENTRAL_FILE_SIGNATURE) {
      throw new Error('CHART_BUNDLE_ZIP_INVALID')
    }

    const flags = archive.readUInt16LE(cursor + 8)
    const compression = archive.readUInt16LE(cursor + 10)
    const checksum = archive.readUInt32LE(cursor + 16)
    const compressedSize = archive.readUInt32LE(cursor + 20)
    const uncompressedSize = archive.readUInt32LE(cursor + 24)
    const nameLength = archive.readUInt16LE(cursor + 28)
    const extraLength = archive.readUInt16LE(cursor + 30)
    const commentLength = archive.readUInt16LE(cursor + 32)
    const localOffset = archive.readUInt32LE(cursor + 42)
    const end = cursor + 46 + nameLength + extraLength + commentLength
    if (end > archive.length) {
      throw new Error('CHART_BUNDLE_ZIP_INVALID')
    }

    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    validateEntryName(name)
    if (names.has(name)) {
      throw new Error('CHART_BUNDLE_DUPLICATE_ENTRY')
    }
    names.add(name)

    if ((flags & 0x0001) !== 0) {
      throw new Error('CHART_BUNDLE_ENCRYPTED_UNSUPPORTED')
    }
    if (compression !== 0 && compression !== 8) {
      throw new Error('CHART_BUNDLE_COMPRESSION_UNSUPPORTED')
    }
    if (uncompressedSize > limits.maxEntrySize) {
      throw new Error('CHART_BUNDLE_ENTRY_TOO_LARGE')
    }
    totalSize += uncompressedSize
    if (totalSize > limits.maxTotalSize) {
      throw new Error('CHART_BUNDLE_TOO_LARGE')
    }

    descriptors.push({
      name,
      flags,
      compression,
      checksum,
      compressedSize,
      uncompressedSize,
      localOffset
    })
    cursor = end
  }

  if (cursor !== centralOffset + centralSize) {
    throw new Error('CHART_BUNDLE_ZIP_INVALID')
  }

  const result = new Map<string, Buffer>()
  for (const descriptor of descriptors) {
    const offset = descriptor.localOffset
    if (offset + 30 > archive.length || archive.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
      throw new Error('CHART_BUNDLE_ZIP_INVALID')
    }

    const nameLength = archive.readUInt16LE(offset + 26)
    const extraLength = archive.readUInt16LE(offset + 28)
    const dataStart = offset + 30 + nameLength + extraLength
    const dataEnd = dataStart + descriptor.compressedSize
    if (dataEnd > archive.length) {
      throw new Error('CHART_BUNDLE_ZIP_INVALID')
    }

    const compressed = archive.subarray(dataStart, dataEnd)
    let data: Buffer
    try {
      data =
        descriptor.compression === 0
          ? Buffer.from(compressed)
          : inflateRawSync(compressed, { maxOutputLength: limits.maxEntrySize })
    } catch {
      throw new Error('CHART_BUNDLE_ZIP_INVALID')
    }

    if (
      data.length !== descriptor.uncompressedSize ||
      crc32(data) !== descriptor.checksum
    ) {
      throw new Error('CHART_BUNDLE_ZIP_CHECKSUM_INVALID')
    }
    result.set(descriptor.name, data)
  }

  return result
}

function validateEntryName(name: string): void {
  if (
    !name ||
    name.includes('\\') ||
    name.startsWith('/') ||
    /^[a-zA-Z]:/.test(name) ||
    name.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error('CHART_BUNDLE_ENTRY_PATH_INVALID')
  }
}

function findEndOfCentralDirectory(archive: Buffer): number {
  const start = Math.max(0, archive.length - MAX_EOCD_SEARCH)
  for (let index = archive.length - 22; index >= start; index -= 1) {
    if (archive.readUInt32LE(index) === END_SIGNATURE) {
      const commentLength = archive.readUInt16LE(index + 20)
      if (index + 22 + commentLength === archive.length) {
        return index
      }
    }
  }
  return -1
}

function assertUInt32(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error('CHART_BUNDLE_TOO_LARGE')
  }
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()
