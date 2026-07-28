import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../../src/renderer/i18n'

const loginMocks = vi.hoisted(() => ({
  login: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn()
}))

vi.mock('../../../src/renderer/service', () => ({
  login: loginMocks.login
}))

vi.mock('sonner', () => ({
  toast: {
    success: loginMocks.success,
    error: loginMocks.error,
    warning: loginMocks.warning
  }
}))

import { LoginBox } from '../../../src/renderer/window/login/components/loginBox'

describe('LoginBox', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en-US')
  })

  beforeEach(() => {
    loginMocks.login.mockReset()
    Object.defineProperty(window, 'auth', {
      configurable: true,
      value: { login: vi.fn().mockResolvedValue(undefined) }
    })
    Object.defineProperty(window, 'windowManager', {
      configurable: true,
      value: { closeWindow: vi.fn().mockResolvedValue({ success: true }) }
    })
  })

  it('validates required and malformed credentials', async () => {
    const user = userEvent.setup()
    render(<LoginBox />)

    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(screen.getByText('Please enter your email')).toBeInTheDocument()
    expect(screen.getByText('Please enter your password')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'invalid')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    expect(screen.getByText('Please enter a valid email')).toBeInTheDocument()
    expect(loginMocks.login).not.toHaveBeenCalled()
  })

  it('submits valid credentials to service and preload auth API', async () => {
    const user = userEvent.setup()
    const tokenPayload = { token: 'abc' }
    loginMocks.login.mockResolvedValue(tokenPayload)
    render(<LoginBox />)

    await user.type(screen.getByLabelText('Email'), 'pilot@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    await waitFor(() => {
      expect(loginMocks.login).toHaveBeenCalledWith({
        email: 'pilot@example.com',
        password: 'secret'
      })
      expect(window.auth.login).toHaveBeenCalledWith(tokenPayload)
    })
    expect(loginMocks.success).toHaveBeenCalledWith('Login successful')
  })

  it('reports login and registration failures to the user', async () => {
    const user = userEvent.setup()
    loginMocks.login.mockRejectedValue(new Error('network down'))
    render(<LoginBox />)

    await user.type(screen.getByLabelText('Email'), 'pilot@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await waitFor(() => expect(loginMocks.error).toHaveBeenCalledWith('network down'))

    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(loginMocks.warning).toHaveBeenCalledWith(
      'Registration is not available yet'
    )
  })
})
