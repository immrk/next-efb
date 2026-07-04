import { IpcResponse } from '../types/index.js'

/**
 * 创建成功的IPC响应
 */
export function createSuccessResponse<T>(data?: T): IpcResponse<T> {
  return {
    success: true,
    data
  }
}

/**
 * 创建失败的IPC响应
 */
export function createErrorResponse(error: string | Error): IpcResponse {
  return {
    success: false,
    error: error instanceof Error ? error.message : String(error)
  }
}

/**
 * 包装异步操作，自动处理错误
 */
export async function wrapAsyncOperation<T>(
  operation: () => Promise<T>
): Promise<IpcResponse<T>> {
  try {
    const result = await operation()
    return createSuccessResponse(result)
  } catch (error) {
    console.error('IPC操作失败:', error)
    return createErrorResponse(error as Error)
  }
} 