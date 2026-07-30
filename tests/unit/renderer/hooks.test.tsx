import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_NAV_LAYER_VISIBILITY,
  usePersistentMapDisplaySettings
} from '../../../src/renderer/hooks/usePersistentMapDisplaySettings'
import { useAuth } from '../../../src/renderer/composables/useAuth'
import { useTheme } from '../../../src/renderer/composables/useTheme'

describe('renderer hooks', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    delete (window as Partial<Window>).auth
    delete (window as Partial<Window>).system
  })

  it('loads, toggles and persists map layer visibility', async () => {
    window.localStorage.setItem(
      'nextefb.map-display.v1',
      JSON.stringify({ airports: false, vors: true })
    )
    const { result } = renderHook(() => usePersistentMapDisplaySettings())

    expect(result.current.navLayerVisibility).toEqual({
      ...DEFAULT_NAV_LAYER_VISIBILITY,
      airports: false,
      vors: true
    })

    act(() => {
      result.current.toggleNavLayer('airways')
    })
    await waitFor(() => {
      expect(
        JSON.parse(window.localStorage.getItem('nextefb.map-display.v1') ?? '{}')
      ).toMatchObject({ airports: false, vors: true, airways: true })
    })
  })

  it('falls back to default map layers for malformed storage', () => {
    window.localStorage.setItem('nextefb.map-display.v1', '{bad')
    const { result } = renderHook(() => usePersistentMapDisplaySettings())
    expect(result.current.navLayerVisibility).toEqual(DEFAULT_NAV_LAYER_VISIBILITY)
  })

  it('applies, persists and forwards theme changes', async () => {
    const changeTheme = vi.fn().mockResolvedValue(undefined)
    const onChangeTheme = vi.fn(() => () => undefined)
    Object.defineProperty(window, 'system', {
      configurable: true,
      value: {
        getTheme: vi.fn().mockResolvedValue({
          data: { storeTheme: 'dark', systemTheme: 'light' }
        }),
        changeTheme,
        onChangeTheme
      }
    })

    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.themeColor).toBe('dark'))

    await act(async () => {
      await result.current.changeTheme('light')
    })
    expect(result.current).toMatchObject({ themeColor: 'light', isDark: false })
    expect(document.documentElement).not.toHaveClass('dark')
    expect(window.localStorage.getItem('nextefb-theme')).toBe('light')
    expect(changeTheme).toHaveBeenCalledWith('light')
  })

  it('loads, refreshes and clears authentication state', async () => {
    let tokenChanged: (() => void) | null = null
    const auth = {
      getToken: vi
        .fn()
        .mockResolvedValueOnce({ data: { name: 'Pilot' } })
        .mockResolvedValueOnce({ data: { name: 'Captain' } }),
      login: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue({ ok: true }),
      tokenRefresh: vi.fn().mockResolvedValue({ token: 'next' }),
      onTokenChange: vi.fn((listener: () => void) => {
        tokenChanged = listener
      }),
      removeTokenChangeListener: vi.fn()
    }
    Object.defineProperty(window, 'auth', {
      configurable: true,
      value: auth
    })

    const { result, unmount } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.userdata).toEqual({ name: 'Pilot' }))
    expect(window.localStorage.getItem('userdata')).toBe('{"name":"Pilot"}')

    await act(async () => {
      await result.current.login({ token: 'abc' })
      expect(await result.current.tokenRefresh({ token: 'abc' })).toEqual({
        token: 'next'
      })
      await tokenChanged?.()
    })
    await waitFor(() => expect(result.current.userdata).toEqual({ name: 'Captain' }))

    await act(async () => {
      await result.current.logout()
    })
    expect(result.current.userdata).toEqual({})
    expect(window.localStorage.getItem('userdata')).toBeNull()

    unmount()
    expect(auth.removeTokenChangeListener).toHaveBeenCalledOnce()
  })
})
