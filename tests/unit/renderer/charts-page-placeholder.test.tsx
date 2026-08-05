import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import i18n from '../../../src/renderer/i18n'
import { ChartPreviewPlaceholder } from '../../../src/renderer/pages/ChartsPage'

describe('ChartPreviewPlaceholder', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  it('prompts for an airport when the library has airports but none is expanded', () => {
    render(
      <ChartPreviewPlaceholder
        airportCount={4}
        chartCount={0}
        expandedAirportCode={null}
        hasSearch={false}
        isLoadingAirports={false}
        isLoadingCharts={false}
        isLoadingChartDetail={false}
      />
    )

    expect(screen.getByText('Select an airport')).toBeInTheDocument()
    expect(screen.queryByText('No charts')).not.toBeInTheDocument()
  })

  it('keeps the import prompt for a genuinely empty library', () => {
    render(
      <ChartPreviewPlaceholder
        airportCount={0}
        chartCount={0}
        expandedAirportCode={null}
        hasSearch={false}
        isLoadingAirports={false}
        isLoadingCharts={false}
        isLoadingChartDetail={false}
      />
    )

    expect(screen.getByText('No charts')).toBeInTheDocument()
    expect(screen.getByText('Import charts to continue.')).toBeInTheDocument()
  })
})
