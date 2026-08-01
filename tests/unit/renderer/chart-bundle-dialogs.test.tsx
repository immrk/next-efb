import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ChartBundleImportPreview } from '@shared/chart-types'
import i18n from '../../../src/renderer/i18n'
import { ChartBundleImportDialog } from '../../../src/renderer/components/ChartBundleDialogs'

describe('ChartBundleImportDialog', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  it('groups charts by airport and type and supports group selection', () => {
    const onConfirm = vi.fn()
    const preview: ChartBundleImportPreview = {
      sessionId: 'session-1',
      fileName: 'community.zip',
      schemaVersion: 1,
      exportedAt: 1_700_000_000_000,
      totalAssetSizeBytes: 3_072,
      charts: [
        importChart('zspd-star', 'ZSPD', 'star', 'BOGVA 7A'),
        importChart('zbaa-approach', 'ZBAA', 'approach', 'ILS Z 36R', 'update'),
        importChart('zbaa-sid', 'ZBAA', 'sid', 'RENOB 9D')
      ]
    }

    render(
      <ChartBundleImportDialog
        preview={preview}
        pending={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    )

    const airportGroups = document.querySelectorAll('.chart-bundle-airport-group')
    expect(airportGroups).toHaveLength(2)
    expect(within(airportGroups[0] as HTMLElement).getByText('ZBAA')).toBeInTheDocument()
    expect(within(airportGroups[0] as HTMLElement).getByText('SID')).toBeInTheDocument()
    expect(within(airportGroups[0] as HTMLElement).getByText('Approach')).toBeInTheDocument()
    expect(within(airportGroups[1] as HTMLElement).getByText('ZSPD')).toBeInTheDocument()
    expect(within(airportGroups[1] as HTMLElement).getByText('STAR')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Select or clear the ZBAA group'))
    fireEvent.click(screen.getByRole('button', { name: 'Import Selected' }))
    expect(onConfirm).toHaveBeenCalledWith(['zspd-star'])
  })
})

function importChart(
  id: string,
  airportCode: string,
  chartType: 'sid' | 'star' | 'approach',
  title: string,
  action: 'create' | 'update' = 'create'
) {
  return {
    id,
    title,
    airportCode,
    chartType,
    action,
    localTitle: action === 'update' ? 'Local title' : null,
    incomingUpdatedAt: 1_700_000_000_000,
    localUpdatedAt: action === 'update' ? 1_699_000_000_000 : null,
    isOlderThanLocal: false,
    assetSizeBytes: 1_024
  }
}
