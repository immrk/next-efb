import { http } from '../request'

export const getCommon = (params: any) => {
  return http.get('/api/common/get', {
    params,
  })
}

export const login = (data: any) => {
  return http.post('/api/user/login', data)
}