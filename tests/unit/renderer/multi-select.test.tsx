import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import {
  MultiSelect,
  type MultiSelectOption
} from '../../../src/renderer/components/ui/multi-select'

const OPTIONS: MultiSelectOption[] = [
  {
    value: '05',
    label: '05',
    description: '3400 m · ASPHALT'
  },
  {
    value: '23',
    label: '23',
    description: '3400 m · ASPHALT'
  }
]

function MultiSelectHarness() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<string[]>([])

  return (
    <>
      <MultiSelect
        label="Runway filter"
        options={OPTIONS}
        value={value}
        open={open}
        onOpenChange={setOpen}
        onValueChange={setValue}
        placeholder="Choose runways"
        searchPlaceholder="Search runways"
        selectAllLabel="Select all"
        clearVisibleLabel="Clear visible"
        selectionSummary={`${value.length} of ${OPTIONS.length} selected`}
        emptyMessage="No runways"
        noResultsMessage="No matches"
      />
      <output data-testid="selected-values">{value.join(',')}</output>
    </>
  )
}

describe('MultiSelect', () => {
  it('shows selected values as chips and maintains multi-select state', async () => {
    const user = userEvent.setup()
    render(<MultiSelectHarness />)

    const trigger = screen.getByRole('combobox', { name: 'Runway filter' })
    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')

    const runway05 = screen.getByRole('option', { name: /05/ })
    await user.click(runway05)

    expect(runway05).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('selected-values')).toHaveTextContent('05')
    expect(trigger).toHaveTextContent('05')
    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument()
  })

  it('filters options and applies the bulk action only to visible results', async () => {
    const user = userEvent.setup()
    render(<MultiSelectHarness />)

    await user.click(screen.getByRole('combobox', { name: 'Runway filter' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search runways' }), '23')

    expect(screen.queryByRole('option', { name: /05/ })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /23/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getByTestId('selected-values')).toHaveTextContent('23')

    await user.click(screen.getByRole('button', { name: 'Clear visible' }))
    expect(screen.getByTestId('selected-values')).toBeEmptyDOMElement()
  })

  it('closes with Escape', async () => {
    const user = userEvent.setup()
    render(<MultiSelectHarness />)

    const trigger = screen.getByRole('combobox', { name: 'Runway filter' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
