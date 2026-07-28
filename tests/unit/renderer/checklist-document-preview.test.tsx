import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChecklistDocumentPreview } from '../../../src/renderer/components/ChecklistDocumentPreview'

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {
    workerSrc: ''
  },
  RenderingCancelledException: class RenderingCancelledException extends Error {},
  getDocument: vi.fn(() => ({
    promise: new Promise(() => {}),
    destroy: vi.fn()
  }))
}))

describe('ChecklistDocumentPreview', () => {
  it('keeps the title toolbar outside the PDF gesture viewport', () => {
    const { container } = render(
      <ChecklistDocumentPreview
        title="A320 Normal Procedures"
        asset={{
          checklistId: 'checklist-1',
          fileFormat: 'pdf',
          mimeType: 'application/pdf',
          base64: 'JVBERi0xLjQ='
        }}
      />
    )

    const preview = container.querySelector('.checklist-document-preview')
    const toolbar = container.querySelector('.checklist-preview-toolbar')
    const viewport = container.querySelector('.checklist-pdf-viewer')

    expect(preview).not.toBeNull()
    expect(toolbar).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(preview?.children[0]).toBe(toolbar)
    expect(preview?.children[1]).toBe(viewport)
    expect(viewport?.contains(toolbar)).toBe(false)
    expect(screen.getByText('A320 Normal Procedures')).toBeVisible()
  })
})
