import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import i18n from '../../../src/renderer/i18n'
import { ChartMountDrawer } from '../../../src/renderer/components/ChartMountDrawer'
import { createChart } from '../../helpers/factories'

describe('VirtualChartMountDrawer', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  it('starts collapsed and keeps only one airport expanded', () => {
    render(
      <ChartMountDrawer
        charts={[
          createChart({ id: 'zbaa', airportCode: 'ZBAA', title: 'Beijing chart' }),
          createChart({ id: 'zspd', airportCode: 'ZSPD', title: 'Shanghai chart' })
        ]}
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByText('Beijing chart')).not.toBeInTheDocument()
    expect(screen.getByText('Airports')).toBeInTheDocument()
    expect(screen.getByText('2 airports')).toBeInTheDocument()
    fireEvent.click(screen.getByText('ZBAA'))
    expect(screen.getByText('Beijing chart')).toBeInTheDocument()

    fireEvent.click(screen.getByText('ZSPD'))
    expect(screen.queryByText('Beijing chart')).not.toBeInTheDocument()
    expect(screen.getByText('Shanghai chart')).toBeInTheDocument()
  })

  it('uses a readable label for charts without an airport assignment', () => {
    render(
      <ChartMountDrawer
        charts={[createChart({ id: 'unassigned', airportCode: null, title: 'Reference chart' })]}
      />
    )

    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.queryByText('UNSPEC')).not.toBeInTheDocument()
  })

  it('virtualizes a large airport list', () => {
    const charts = Array.from({ length: 200 }, (_, index) =>
      createChart({
        id: `chart-${index}`,
        airportCode: `A${String(index).padStart(3, '0')}`,
        title: `Chart ${index}`
      })
    )
    const { container } = render(<ChartMountDrawer charts={charts} />)

    expect(container.querySelectorAll('.chart-picker-virtual-row').length).toBeLessThan(40)
    expect(screen.getByText('A000')).toBeInTheDocument()
    expect(screen.queryByText('A199')).not.toBeInTheDocument()
  })
})
