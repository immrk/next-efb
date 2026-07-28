import { act, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import i18n from '../../../src/renderer/i18n'
import {
  ChartAircraftArrow,
  createAircraftLeafletIcon
} from '../../../src/renderer/components/AircraftArrow'
import { ConnectionBadge } from '../../../src/renderer/components/ConnectionBadge'
import { StatusPanel } from '../../../src/renderer/components/StatusPanel'
import { useAppStore } from '../../../src/renderer/store/useAppStore'
import {
  createAircraft,
  createConnection,
  createSettings
} from '../../helpers/factories'

describe('renderer state and telemetry components', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  beforeEach(() => {
    act(() => {
      useAppStore.setState({
        aircraft: null,
        connection: null,
        settings: null,
        language: 'en-US'
      })
    })
  })

  it('updates aircraft, connection, settings and language state', () => {
    const aircraft = createAircraft()
    const connection = createConnection()
    const settings = createSettings()

    act(() => {
      useAppStore.getState().setAircraft(aircraft)
      useAppStore.getState().setConnection(connection)
      useAppStore.getState().setSettings(settings)
      useAppStore.getState().setLanguage('zh-CN')
    })

    expect(useAppStore.getState()).toMatchObject({
      aircraft,
      connection,
      language: 'zh-CN',
      settings: expect.objectContaining({ language: 'zh-CN' })
    })
  })

  it('renders connected and disconnected badges from store state', () => {
    const { rerender } = render(<ConnectionBadge />)
    expect(screen.getByText('Game disconnected')).toBeInTheDocument()

    act(() => {
      useAppStore.getState().setConnection(createConnection())
    })
    rerender(<ConnectionBadge />)
    expect(screen.getByText('Game connected')).toBeInTheDocument()
  })

  it('formats missing and live telemetry values', () => {
    const { rerender } = render(<StatusPanel />)
    expect(screen.getByText('-- ft')).toBeInTheDocument()
    expect(screen.getByText('-- kts')).toBeInTheDocument()

    act(() => {
      useAppStore.getState().setAircraft(
        createAircraft({
          altitudeFt: 1234.4,
          headingDeg: 87.6,
          groundSpeedKts: 101.25,
          source: 'simconnect'
        })
      )
    })
    rerender(<StatusPanel />)

    expect(screen.getByText('1234 ft')).toBeInTheDocument()
    expect(screen.getByText('88 deg')).toBeInTheDocument()
    expect(screen.getByText('101.3 kts')).toBeInTheDocument()
    expect(screen.getByText('simconnect')).toBeInTheDocument()
  })

  it('creates map and chart aircraft arrows with the supplied position and heading', () => {
    const icon = createAircraftLeafletIcon(135)
    expect(icon.options.className).toBe('aircraft-arrow-icon')
    expect(icon.options.html).toContain('rotate(135deg)')
    expect(icon.options.iconAnchor).toEqual([14, 14])

    const { container } = render(
      <ChartAircraftArrow x="25%" y={320} headingDeg={270} />
    )
    expect(container.firstChild).toHaveStyle({
      left: '25%',
      top: '320px',
      transform: 'translate(-50%, -50%) rotate(270deg)'
    })
  })
})
