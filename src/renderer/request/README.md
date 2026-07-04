# Axios 封装使用说明

这是一个专为 Electron 渲染层设计的 axios 封装，提供了完整的请求拦截、响应拦截、错误处理、重试机制等功能。

## 功能特性

- ✅ **请求拦截器**: 自动添加 token、时间戳等
- ✅ **响应拦截器**: 统一处理响应数据和错误
- ✅ **错误处理**: 分类处理网络错误和业务错误
- ✅ **重试机制**: 支持请求失败自动重试
- ✅ **类型支持**: 完整的 TypeScript 类型定义
- ✅ **便捷方法**: 提供简化的请求方法
- ✅ **配置灵活**: 支持全局配置和单次请求配置

## 快速开始

### 基本使用

```typescript
import { http, request } from '@/renderer/request'

// 使用 HttpClient 实例
const user = await http.get<User>('/user/info')

// 使用便捷方法
const data = await request.get('/api/data')
```

### 发送不同类型的请求

```typescript
// GET 请求
const users = await http.get<User[]>('/users')

// POST 请求
const newUser = await http.post<User>('/users', {
  name: '张三',
  email: 'zhangsan@example.com'
})

// PUT 请求
const updatedUser = await http.put<User>('/users/1', {
  name: '李四'
})

// DELETE 请求
await http.delete('/users/1')

// PATCH 请求
const patchedUser = await http.patch<User>('/users/1', {
  email: 'lisi@example.com'
})
```

## 配置选项

### 请求配置 (RequestConfig)

```typescript
interface RequestConfig extends AxiosRequestConfig {
  showLoading?: boolean    // 是否显示加载状态
  showError?: boolean      // 是否显示错误提示
  retry?: number          // 重试次数
  retryDelay?: number     // 重试间隔(毫秒)
}
```

### 使用配置

```typescript
// 带配置的请求
const data = await http.get('/api/data', {
  showLoading: true,      // 显示加载状态
  showError: true,        // 显示错误提示
  retry: 3,              // 失败时重试3次
  retryDelay: 2000,      // 每次重试间隔2秒
  timeout: 5000,         // 请求超时时间
  headers: {             // 自定义请求头
    'X-Custom-Header': 'value'
  }
})
```

## 错误处理

### 错误类型

- **BusinessError**: 业务逻辑错误 (code !== 200)
- **NetworkError**: 网络请求错误 (401, 403, 404, 500等)

### 错误处理示例

```typescript
try {
  const data = await http.get('/api/data', {
    showError: false // 禁用默认错误提示
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
```

## 认证管理

### 设置 Token

```typescript
// 设置认证 token
http.setToken('your-jwt-token')

// 清除 token
http.clearToken()
```

### 自动 Token 管理

请求拦截器会自动从 localStorage 中读取 token 并添加到请求头中：

```typescript
// 登录成功后保存 token
localStorage.setItem('token', response.token)

// 后续请求会自动携带 token
const userInfo = await http.get('/user/info')
```

## 响应数据格式

默认期望的响应格式：

```typescript
interface ApiResponse<T = any> {
  code: number      // 状态码
  message: string   // 消息
  data: T          // 数据
  success: boolean  // 是否成功
}
```

响应拦截器会自动提取 `data` 字段返回，如果 `code !== 200` 或 `success !== true` 会抛出业务错误。

## 环境配置

### 设置 API 基础地址

在 `.env` 文件中设置：

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

或者在代码中动态设置：

```typescript
// 创建自定义实例
const customHttp = new HttpClient()
customHttp.instance.defaults.baseURL = 'http://your-api-domain.com'
```

## 高级用法

### 自定义请求头

```typescript
// 设置全局请求头
http.setHeader('X-Custom-Header', 'custom-value')

// 移除请求头
http.removeHeader('X-Custom-Header')
```

### 文件上传

```typescript
const formData = new FormData()
formData.append('file', file)

const result = await http.post('/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
})
```

### 请求取消

```typescript
import { CancelToken } from 'axios'

const source = CancelToken.source()

const request = http.get('/api/data', {
  cancelToken: source.token
})

// 取消请求
source.cancel('请求被取消')
```

## 与 React 集成

### 在 React 组件中使用

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { http } from '@/request'

export function LoginExample() {
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<{ name: string } | null>(null)

  const handleLogin = async () => {
    setLoading(true)
    try {
      const result = await http.post('/auth/login', {
        username: 'admin',
        password: '123456'
      })
      setUser(result.user)
    } catch (error) {
      console.error('登录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button disabled={loading} onClick={() => void handleLogin()}>
        {loading ? '登录中...' : '登录'}
      </Button>
      {user && <div>{user.name}</div>}
    </div>
  )
}
```

### 与 shadcn/ui 和 Sonner 集成

请求层只负责抛出错误，React 页面使用 shadcn 按钮管理加载态，并通过
`sonner` 的 `toast.error(error.message)` 统一展示错误提示。

## 最佳实践

1. **统一错误处理**: 在应用层面统一处理常见错误
2. **类型安全**: 为所有 API 响应定义 TypeScript 接口
3. **环境配置**: 使用环境变量管理不同环境的 API 地址
4. **请求优化**: 合理使用重试机制和缓存策略
5. **用户体验**: 提供适当的加载状态和错误提示

## 注意事项

- 确保在 Electron 环境中正确配置了网络权限
- 注意跨域请求的处理
- 合理设置请求超时时间
- 避免在请求拦截器中执行耗时操作
