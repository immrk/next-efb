import { describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => ({
  openExternal: vi.fn().mockResolvedValue(true)
}))

vi.mock('../../../src/renderer/client', () => ({
  getAppClient: () => ({
    openExternal: runtimeMocks.openExternal
  })
}))

import { installRendererRuntime } from '../../../src/renderer/runtime'

describe('renderer runtime integration', () => {
  it('tracks viewport metrics and intercepts only external links', () => {
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 700,
        width: 1100,
        offsetTop: 10,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800
    })

    installRendererRuntime()
    const root = document.documentElement
    expect(root.style.getPropertyValue('--app-viewport-height')).toBe('700px')
    expect(root.style.getPropertyValue('--app-viewport-offset-top')).toBe('10px')
    expect(root.style.getPropertyValue('--app-viewport-offset-bottom')).toBe('90px')
    expect(root.dataset.webappMode).toBe('browser')

    const external = document.createElement('a')
    external.href = 'https://example.com/docs'
    external.textContent = 'external'
    document.body.appendChild(external)
    const externalClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0
    })
    external.dispatchEvent(externalClick)
    expect(externalClick.defaultPrevented).toBe(true)
    expect(runtimeMocks.openExternal).toHaveBeenCalledWith('https://example.com/docs')

    const internal = document.createElement('a')
    internal.href = '/settings'
    document.body.appendChild(internal)
    const internalClick = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0
    })
    internal.dispatchEvent(internalClick)
    expect(internalClick.defaultPrevented).toBe(false)
  })
})
