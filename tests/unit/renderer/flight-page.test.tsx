import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type {
  SimBriefFlightDetails,
  SimBriefImportResult
} from '../../../src/shared/flight-plan-types'
import i18n from '../../../src/renderer/i18n'
import { FlightPage } from '../../../src/renderer/pages/FlightPage'

describe('FlightPage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  it('renders the SimBrief snapshot as read-only flight information', () => {
    render(
      <FlightPage
        simBriefPlan={createSimBriefPlan()}
        isImporting={false}
        navDataReady
        onImport={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByRole('heading', { name: 'Flight' })).toBeInTheDocument()
    expect(
      screen.queryByText('Read-only snapshot of the latest SimBrief import.')
    ).not.toBeInTheDocument()
    expect(screen.getAllByText('CXA1106')).toHaveLength(2)
    expect(screen.getByText('ZSPD / PVG · 16R')).toBeInTheDocument()
    expect(
      screen.getByText('ZSPD/16R K0826S0780 NXD84D NXD W131 AKDIM ZSAM/05')
    ).toBeInTheDocument()
    const briefing = screen.getByLabelText('Briefing Preview')
    expect(briefing.textContent?.split('\n')).toHaveLength(1120)
    expect(briefing.textContent).toContain('[ OFP ]')
    expect(briefing.textContent).toContain('FINAL OFP LINE')
    expect(
      screen.getByRole('link', { name: 'How do I read this briefing?' })
    ).toHaveAttribute(
      'href',
      'https://www.simbrief.com/system/guide.php?ofpformat=lido#ofpsample'
    )
    expect(screen.getAllByText('CI 58')).toHaveLength(1)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('switches load sheet values between kilograms and pounds without editing the snapshot', () => {
    render(
      <FlightPage
        simBriefPlan={createSimBriefPlan()}
        isImporting={false}
        navDataReady
        onImport={vi.fn()}
        onClear={vi.fn()}
      />
    )

    expect(screen.getByText('4,054 kg')).toBeInTheDocument()

    const poundsButton = screen.getByRole('button', {
      name: 'Show weights in pounds'
    })
    fireEvent.click(poundsButton)

    expect(poundsButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('8,938 lb')).toBeInTheDocument()
    expect(screen.queryByText('4,054 kg')).not.toBeInTheDocument()
  })
})

function createSimBriefPlan(): SimBriefImportResult {
  return {
    departureAirport: 'ZSPD',
    destinationAirport: 'ZSAM',
    alternateAirport: 'ZSFZ',
    routeText: 'K0826S0780 NXD84D NXD W131 AKDIM',
    departureRunway: '16R',
    arrivalRunway: '05',
    departureProcedureName: null,
    arrivalProcedureName: null,
    approachProcedureName: null,
    arrivalTransitionName: null,
    source: 'simbrief',
    details: {
      flightNumber: 'CXA1106',
      callsign: 'CXA1106',
      departureIata: 'PVG',
      destinationIata: 'XMN',
      alternateIata: 'FOC',
      aircraftType: 'B737',
      aircraftName: 'B737-700',
      registration: 'N714SB',
      scheduledOut: '1785200700',
      scheduledOff: '1785201000',
      scheduledOn: '1785206340',
      scheduledIn: '1785207000',
      airTimeSeconds: '5340',
      blockTimeSeconds: '7020',
      initialAltitude: '25600',
      cruiseProfile: 'CI 58',
      costIndex: '58',
      routeDistance: '561',
      averageWindDirection: '219',
      averageWindSpeed: '5',
      windComponent: '-3',
      isaDeviation: '18',
      releaseNumber: '1',
      airacCycle: '2503',
      ofpLayout: 'LIDO',
      units: 'kgs',
      navlog: '1',
      etops: '0',
      enrouteBurn: '4054',
      passengerCount: '148',
      emptyWeight: '38156',
      estimatedZfw: '53596',
      estimatedTow: '60496',
      estimatedLandingWeight: '56442',
      blockFuel: '7127',
      baggageWeight: '3692',
      payloadWeight: '15440',
      maxZfw: '55202',
      maxTow: '70080',
      maxLandingWeight: '58604',
      atcFlightPlan: '(FPL-CXA1106-IS)',
      briefingText: createFullBriefing()
    } satisfies SimBriefFlightDetails
  }
}

function createFullBriefing(): string {
  return [
    '[ OFP ]',
    ...Array.from(
      { length: 1118 },
      (_, index) => `OFP LINE ${String(index + 1).padStart(4, '0')}`
    ),
    'FINAL OFP LINE'
  ].join('\n')
}
