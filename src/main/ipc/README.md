# IPC 模块说明

## 概述

IPC (Inter-Process Communication) 模块负责处理主进程与渲染进程之间的通信。本模块采用模块化设计，便于维护和扩展。

## 目录结构

```
src/main/ipc/
├── index.ts              # 主入口文件，统一注册所有IPC处理器
├── handlers/             # 具体的IPC处理器模块
│   ├── window.ts        # 窗口管理相关IPC
│   ├── app.ts           # 应用生命周期相关IPC
│   └── system.ts        # 系统相关IPC
├── types/               # IPC相关的类型定义
│   └── index.ts         # 统一导出类型
├── utils/               # IPC工具函数
│   └── response.ts      # 统一响应格式
└── README.md            # 本文档
```

## 模块说明

### 1. 主入口 (index.ts)
- 统一管理所有IPC处理器的注册
- 提供统一的导出接口
- 便于调试和日志记录

### 2. 处理器模块 (handlers/)
- **window.ts**: 窗口管理相关操作
  - 创建、显示、隐藏、关闭窗口
  - 窗口状态查询（存在性、可见性）
  - 窗口操作（聚焦、最小化、最大化、恢复）
  
- **app.ts**: 应用生命周期管理
  - 获取应用信息
  - 应用退出、重启
  - 应用路径管理
  - 应用状态查询
  
- **system.ts**: 系统相关功能
  - 外部链接打开
  - 文件操作
  - 剪贴板操作
  - 系统信息获取
  - 主题检测

### 3. 类型定义 (types/)
- 统一的响应格式类型
- 窗口相关类型
- 应用相关类型
- 便于类型安全和代码提示

### 4. 工具函数 (utils/)
- **response.ts**: 统一响应格式处理
  - 成功响应创建
  - 错误响应创建
  - 异步操作包装

## 使用方式

### 在主进程中注册IPC处理器

```typescript
import { setupIpcHandlers } from './ipc/index.js'

app.whenReady().then(() => {
  setupIpcHandlers() // 注册所有IPC处理器
  // 其他初始化代码...
})
```

### 在渲染进程中调用IPC

```typescript
// 窗口操作
const result = await window.electronAPI.invoke('window:create', 'main')
const windows = await window.electronAPI.invoke('window:getAll')

// 应用操作
const appInfo = await window.electronAPI.invoke('app:getInfo')

// 系统操作
await window.electronAPI.invoke('system:openExternal', 'https://example.com')
```

## 响应格式

所有IPC调用都返回统一的响应格式：

```typescript
interface IpcResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}
```

### 成功响应示例
```json
{
  "success": true,
  "data": { "name": "main", "isVisible": true }
}
```

### 错误响应示例
```json
{
  "success": false,
  "error": "窗口创建失败"
}
```

## 扩展指南

### 添加新的IPC处理器

1. 在 `handlers/` 目录下创建新的处理器文件
2. 实现处理器函数，使用 `wrapAsyncOperation` 包装异步操作
3. 在 `index.ts` 中导入并注册新的处理器

### 添加新的类型定义

1. 在 `types/index.ts` 中添加新的接口定义
2. 在相应的处理器中使用这些类型

### 添加新的工具函数

1. 在 `utils/` 目录下创建新的工具文件
2. 在 `index.ts` 中导出新的工具函数

## 最佳实践

1. **统一错误处理**: 使用 `wrapAsyncOperation` 确保所有异步操作都有统一的错误处理
2. **类型安全**: 为所有IPC调用定义明确的类型
3. **模块化**: 按功能将IPC处理器分组到不同的模块中
4. **文档化**: 为每个IPC处理器添加清晰的注释说明
5. **测试**: 为重要的IPC功能编写测试用例 