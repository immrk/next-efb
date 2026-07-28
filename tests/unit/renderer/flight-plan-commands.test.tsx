import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import i18n from '../../../src/renderer/i18n'
import { FlightPlanCommands } from '../../../src/renderer/components/FlightPlanCommands'

describe('FlightPlanCommands', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  it('explains the shared import scope and waits for confirmation', () => {
    const onImport = vi.fn()

    render(
      <FlightPlanCommands
        isImporting={false}
        onImport={onImport}
        onClear={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Import from SimBrief' }))

    expect(onImport).not.toHaveBeenCalled()
    expect(
      screen.getByRole('dialog', { name: 'Import SimBrief flight?' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Map: departure, arrival, procedures/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Flight: flight information and the complete OFP snapshot/)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Edits made on the Map after importing will not change/)
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onImport).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Import from SimBrief' }))
    fireEvent.click(screen.getByRole('button', { name: 'Import and Replace' }))

    expect(onImport).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains that clear affects both pages and waits for confirmation', () => {
    const onClear = vi.fn()

    render(
      <FlightPlanCommands
        isImporting={false}
        onImport={vi.fn()}
        onClear={onClear}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear Route' }))

    expect(onClear).not.toHaveBeenCalled()
    expect(
      screen.getByRole('dialog', { name: 'Clear route and flight snapshot?' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Map: route fields/)).toBeInTheDocument()
    expect(screen.getByText(/Flight: the imported SimBrief snapshot/)).toBeInTheDocument()
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear Both Pages' }))

    expect(onClear).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('dismisses confirmation with Escape without performing the action', () => {
    const onClear = vi.fn()

    render(
      <FlightPlanCommands
        isImporting={false}
        onImport={vi.fn()}
        onClear={onClear}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Clear Route' }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClear).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
