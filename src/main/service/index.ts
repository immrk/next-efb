import { netRequest } from '../request'

export const getCommon = (params: any) => {
  return netRequest({
    url: '/api/common/get',
    method: 'GET',
    params,
  })
}

export const tokenRefresh = (data: any) => {
  return netRequest({
    url: '/api/user/refresh',
    method: 'POST',
    data,
  })
}