import { computed, readonly, ref } from 'vue'

export interface MockUser {
  email: string
  username: string
  avatar: string
  accessToken: string
  refreshToken: string
}

const STORAGE_KEY = 'nextefb.mock-user'
const user = ref<MockUser | null>(readStoredUser())

export function useAuth() {
  const isLoggedIn = computed(() => Boolean(user.value?.accessToken))

  async function login(_credentials: { email: string; password: string }): Promise<MockUser> {
    const mockUser: MockUser = {
      email: 'test@test.com',
      username: 'test',
      avatar:
        'https://s.gravatar.com/avatar/a8248fe42a393dd6eac1ae0069bf8b2a?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fke.png',
      accessToken: '123456',
      refreshToken: '123456'
    }
    user.value = mockUser
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockUser))
    return mockUser
  }

  function logout(): void {
    user.value = null
    window.localStorage.removeItem(STORAGE_KEY)
  }

  return {
    user: readonly(user),
    isLoggedIn,
    login,
    logout
  }
}

function readStoredUser(): MockUser | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? (JSON.parse(value) as MockUser) : null
  } catch {
    return null
  }
}
