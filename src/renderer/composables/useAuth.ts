import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [userdata, setUserdata] = useState<any>({})

  const getToken = useCallback(async () => {
    if (!window.auth) return {}
    const data = await window.auth.getToken()
    const nextUser = data.data || {}
    setUserdata(nextUser)
    localStorage.setItem('userdata', JSON.stringify(nextUser))
    return nextUser
  }, [])

  const login = async (data: any) => {
    await window.auth?.login(data)
  }

  const tokenRefresh = async (data: any) => {
    const res = await window.auth?.tokenRefresh(data)
    return res
  }

  const logout = async () => {
    const res = await window.auth?.logout()
    setUserdata({})
    localStorage.removeItem('userdata')
    return res
  }

  useEffect(() => {
    void getToken()
    if (!window.auth) return
    window.auth.onTokenChange(async () => {
      await getToken()
    })
    return () => window.auth.removeTokenChangeListener()
  }, [getToken])

  return {
    getToken,
    login,
    tokenRefresh,
    logout,
    userdata,
  }
}
