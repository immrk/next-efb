import { http, request, ApiResponse } from './index'

// 定义用户接口
interface User {
  id: number
  name: string
  email: string
}

// 定义登录请求参数
interface LoginParams {
  username: string
  password: string
}

// 定义登录响应
interface LoginResponse {
  token: string
  user: User
}

// 使用示例
export class ApiService {
  // 登录
  static async login(params: LoginParams): Promise<LoginResponse> {
    try {
      const response = await http.post<LoginResponse>('/auth/login', params, {
        showLoading: true,
        showError: true,
      })
      
      // 保存token
      if (response.token) {
        localStorage.setItem('token', response.token)
        http.setToken(response.token)
      }
      
      return response
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  }

  // 获取用户信息
  static async getUserInfo(): Promise<User> {
    return http.get<User>('/user/info', {
      showLoading: false,
      retry: 2,
      retryDelay: 1000,
    })
  }

  // 更新用户信息
  static async updateUserInfo(userData: Partial<User>): Promise<User> {
    return http.put<User>('/user/info', userData, {
      showLoading: true,
      showError: true,
    })
  }

  // 删除用户
  static async deleteUser(userId: number): Promise<void> {
    return http.delete(`/user/${userId}`, {
      showLoading: true,
      showError: true,
    })
  }

  // 获取用户列表
  static async getUserList(params?: {
    page?: number
    pageSize?: number
    keyword?: string
  }): Promise<{
    list: User[]
    total: number
    page: number
    pageSize: number
  }> {
    return http.get('/user/list', {
      params,
      showLoading: true,
    })
  }

  // 上传文件
  static async uploadFile(file: File): Promise<{ url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    
    return http.post<{ url: string }>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      showLoading: true,
      showError: true,
    })
  }
}

// 使用便捷方法的示例
export const apiExamples = {
  // 使用便捷方法
  async getData() {
    return request.get('/api/data')
  },

  async createData(data: any) {
    return request.post('/api/data', data)
  },

  async updateData(id: number, data: any) {
    return request.put(`/api/data/${id}`, data)
  },

  async deleteData(id: number) {
    return request.delete(`/api/data/${id}`)
  },
}

// 在 React 组件中的使用示例
export const reactComponentExample = `
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ApiService } from '@/request/example'

export function RequestExample() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    try {
      const result = await ApiService.login({
        username: 'admin',
        password: '123456'
      })
      console.log('登录成功:', result)
    } catch (error) {
      console.error('登录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button disabled={loading} onClick={() => void handleLogin()}>
      {loading ? '登录中...' : '登录'}
    </Button>
  )
}
`

// 错误处理示例
export const errorHandlingExample = `
// 自定义错误处理
try {
  const data = await http.get('/api/data', {
    showError: false, // 禁用默认错误提示
  })
} catch (error) {
  if (error.name === 'BusinessError') {
    // 处理业务错误
    console.log('业务错误:', error.message)
  } else if (error.name === 'NetworkError') {
    // 处理网络错误
    console.log('网络错误:', error.message)
  }
}

// 重试机制
const data = await http.get('/api/data', {
  retry: 3,        // 重试3次
  retryDelay: 2000, // 每次重试间隔2秒
})
`

// 配置示例
export const configExample = `
// 设置全局配置
http.setHeader('X-Custom-Header', 'custom-value')
http.setToken('your-jwt-token')

// 清除配置
http.clearToken()
http.removeHeader('X-Custom-Header')
`
