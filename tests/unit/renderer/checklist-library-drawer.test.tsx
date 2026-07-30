import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import i18n from '../../../src/renderer/i18n'
import { ChecklistLibraryDrawer } from '../../../src/renderer/components/ChecklistLibraryDrawer'
import { ChecklistMetadataDialog } from '../../../src/renderer/components/ChecklistMetadataDialog'
import { LibraryWorkspace } from '../../../src/renderer/components/LibraryWorkspace'
import { createChecklist } from '../../helpers/factories'

describe('ChecklistLibraryDrawer', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  it('groups by aircraft model, selects a checklist and filters by title', () => {
    const onSelect = vi.fn()
    render(
      <ChecklistLibraryDrawer
        checklists={[
          createChecklist({ id: 'normal', aircraftModel: 'A320', title: 'Normal Procedures' }),
          createChecklist({ id: 'emergency', aircraftModel: 'A320', title: 'Emergency' }),
          createChecklist({ id: 'boeing', aircraftModel: 'B737', title: 'Quick Reference' })
        ]}
        selectedChecklistId="normal"
        importUrlValue=""
        importUrlPending={false}
        onSelect={onSelect}
        onEdit={vi.fn()}
        onImportUrlValueChange={vi.fn()}
        onImport={vi.fn()}
        onImportFromUrl={vi.fn()}
      />
    )

    expect(screen.getByText('A320')).toBeInTheDocument()
    expect(screen.getByText('B737')).toBeInTheDocument()
    expect(screen.getByText('Normal Procedures').closest('article')).toHaveClass('selected')

    fireEvent.click(screen.getByText('Quick Reference'))
    expect(onSelect).toHaveBeenCalledWith('boeing')

    fireEvent.change(screen.getByPlaceholderText('Search by checklist or aircraft model'), {
      target: { value: 'emergency' }
    })
    expect(screen.getByText('Emergency')).toBeInTheDocument()
    expect(screen.queryByText('Quick Reference')).not.toBeInTheDocument()

    const a320Group = screen.getByText('A320').closest('section')
    expect(a320Group).not.toBeNull()
    expect(within(a320Group as HTMLElement).getByText('Emergency')).toBeInTheDocument()
  })

  it('keeps the import toolbar identical to the chart workflow', () => {
    render(
      <ChecklistLibraryDrawer
        checklists={[]}
        selectedChecklistId={null}
        importUrlValue="https://example.com/checklist.pdf"
        importUrlPending={false}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onImportUrlValueChange={vi.fn()}
        onImport={vi.fn()}
        onImportFromUrl={vi.fn()}
      />
    )

    fireEvent.click(screen.getByLabelText('Add checklist'))
    expect(screen.getByLabelText('Import checklist')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Download' })).toBeEnabled()
    expect(screen.queryByLabelText('Aircraft model')).not.toBeInTheDocument()
  })

  it('collects aircraft metadata after file selection and supports later edits', () => {
    const onSubmit = vi.fn()
    render(
      <ChecklistMetadataDialog
        mode="edit"
        initialTitle="Normal Procedures"
        initialAircraftModel="A320"
        pending={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    )

    fireEvent.change(screen.getByLabelText('Aircraft model'), {
      target: { value: 'a321' }
    })
    fireEvent.change(screen.getByLabelText('Checklist title'), {
      target: { value: 'Updated Normal Procedures' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Updated Normal Procedures',
      aircraftModel: 'A321'
    })
  })

  it('collapses and expands the checklist library pane', () => {
    function CollapsibleLibrary() {
      const [collapsed, setCollapsed] = useState(false)
      return (
        <LibraryWorkspace
          library={<div>Checklist library content</div>}
          preview={<div>PDF preview</div>}
          libraryCollapsed={collapsed}
          onLibraryCollapsedChange={setCollapsed}
          collapseLibraryLabel="Collapse checklist sidebar"
          expandLibraryLabel="Expand checklist sidebar"
        />
      )
    }

    render(<CollapsibleLibrary />)
    expect(screen.getByText('Checklist library content')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Collapse checklist sidebar'))
    expect(screen.queryByText('Checklist library content')).not.toBeInTheDocument()
    expect(screen.getByText('PDF preview')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Expand checklist sidebar'))
    expect(screen.getByText('Checklist library content')).toBeInTheDocument()
  })
})
