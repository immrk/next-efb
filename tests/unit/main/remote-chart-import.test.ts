import { afterEach, describe, expect, it, vi } from 'vitest'
import { RemoteChartImportService } from '../../../src/main/services/storage/RemoteChartImportService'

describe('RemoteChartImportService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(['', 'not-a-url', 'file:///tmp/chart.pdf', 'ftp://example.com/chart.pdf'])(
    'rejects invalid remote URL %j',
    async (url) => {
      await expect(new RemoteChartImportService().download(url)).rejects.toThrow(
        'REMOTE_URL_INVALID'
      )
    }
  )

  it('reports HTTP, empty file and unsupported file failures', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock.mockResolvedValueOnce(new Response('no', { status: 404 }))
    await expect(
      new RemoteChartImportService().download('https://example.com/chart.pdf')
    ).rejects.toThrow('REMOTE_DOWNLOAD_FAILED:404')

    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(), { status: 200 }))
    await expect(
      new RemoteChartImportService().download('https://example.com/chart.pdf')
    ).rejects.toThrow('REMOTE_FILE_EMPTY')

    fetchMock.mockResolvedValueOnce(
      new Response('plain text', {
        status: 200,
        headers: { 'content-type': 'text/plain' }
      })
    )
    await expect(
      new RemoteChartImportService().download('https://example.com/chart')
    ).rejects.toThrow('REMOTE_FILE_TYPE_UNSUPPORTED')
  })

  it('detects PDF by signature and decodes a UTF-8 download name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(Buffer.from('%PDF-1.7 test'), {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-disposition': "attachment; filename*=UTF-8''ZBAA%20ILS.pdf"
          }
        })
      )
    )

    await expect(
      new RemoteChartImportService().download('https://example.com/download')
    ).resolves.toEqual({
      sourcePath: null,
      fileName: 'ZBAA ILS.pdf',
      fileFormat: 'pdf',
      mimeType: 'application/pdf',
      base64: Buffer.from('%PDF-1.7 test').toString('base64')
    })
  })

  it('uses content type or path and appends the correct extension', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(Buffer.from('image-data'), {
          status: 200,
          headers: {
            'content-type': 'image/png; charset=binary',
            'content-disposition': 'attachment; filename="airport:diagram"'
          }
        })
      )
    )

    const result = await new RemoteChartImportService().download(
      'https://example.com/files/ignored'
    )
    expect(result).toMatchObject({
      fileName: 'airport_diagram.png',
      fileFormat: 'png',
      mimeType: 'image/png'
    })
  })
})
