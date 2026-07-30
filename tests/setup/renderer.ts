import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-webapp-mode')
})

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

class ResizeObserverMock implements ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => 'blob:test')
}

if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn()
}
