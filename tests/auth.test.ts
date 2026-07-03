import { beforeEach, describe, expect, it } from 'vitest'
import { useAuth } from '../src/renderer/composables/useAuth'

describe('template mock authentication', () => {
  beforeEach(() => {
    useAuth().logout()
  })

  it('returns and persists the template mock user', async () => {
    const auth = useAuth()
    const user = await auth.login({ email: 'pilot@example.com', password: 'secret' })

    expect(user).toMatchObject({
      email: 'test@test.com',
      username: 'test',
      accessToken: '123456',
      refreshToken: '123456'
    })
    expect(auth.isLoggedIn.value).toBe(true)
    expect(window.localStorage.getItem('nextefb.mock-user')).toContain('test@test.com')
  })

  it('clears the mock session on logout', async () => {
    const auth = useAuth()
    await auth.login({ email: 'pilot@example.com', password: 'secret' })
    auth.logout()

    expect(auth.user.value).toBeNull()
    expect(auth.isLoggedIn.value).toBe(false)
    expect(window.localStorage.getItem('nextefb.mock-user')).toBeNull()
  })
})
