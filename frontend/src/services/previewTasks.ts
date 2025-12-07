import { apiClient } from './api'
import type {
  ApiResponse,
  PreviewTask,
  CreatePreviewTaskRequest,
  CreatePreviewTaskResponse,
} from '../types'

/**
 * 创建异步预览任务
 */
export const createPreviewTask = async (
  data: CreatePreviewTaskRequest
): Promise<ApiResponse<CreatePreviewTaskResponse>> => {
  return apiClient.post<ApiResponse<CreatePreviewTaskResponse>>(
    '/preview-tasks',
    data
  )
}

/**
 * 获取用户的所有预览任务
 */
export const getPreviewTasks = async (params?: {
  status?: 'pending' | 'running' | 'completed' | 'failed'
  limit?: number
  offset?: number
}): Promise<ApiResponse<PreviewTask[]>> => {
  const queryParams = new URLSearchParams()
  if (params?.status) queryParams.append('status', params.status)
  if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString())
  if (params?.offset !== undefined) queryParams.append('offset', params.offset.toString())

  const url = `/preview-tasks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
  return apiClient.get<ApiResponse<PreviewTask[]>>(url)
}

/**
 * 获取单个任务详情
 */
export const getPreviewTaskDetail = async (
  taskId: string
): Promise<ApiResponse<PreviewTask>> => {
  return apiClient.get<ApiResponse<PreviewTask>>(`/preview-tasks/${taskId}`)
}

/**
 * 轮询获取任务状态（用于进度页面）
 * 默认间隔增加到5秒，避免频繁请求导致429错误
 */
export const pollPreviewTaskStatus = async (
  taskId: string,
  onUpdate: (task: PreviewTask) => void,
  interval: number = 5000 // 从2秒增加到5秒
): Promise<() => void> => {
  let isPolling = true

  const poll = async () => {
    while (isPolling) {
      try {
        const response = await getPreviewTaskDetail(taskId)
        if (response.success && response.data) {
          onUpdate(response.data)

          // 如果任务已完成或失败，停止轮询
          if (response.data.status === 'completed' || response.data.status === 'failed') {
            isPolling = false
            break
          }
        }
      } catch (error: any) {
        console.error('Failed to poll task status:', error)

        // 如果是网络错误或服务器不可达，停止轮询
        // 检查常见的网络错误标识
        const isNetworkError =
          error?.code === 'ERR_NETWORK' ||
          error?.message?.includes('Network Error') ||
          error?.message?.includes('ERR_CONNECTION_REFUSED') ||
          error?.response?.status === 502 || // Bad Gateway
          error?.response?.status === 503 || // Service Unavailable
          error?.response?.status === 504    // Gateway Timeout

        if (isNetworkError) {
          console.warn('服务器不可达，停止轮询')
          isPolling = false
          break
        }

        // 如果是429限流错误，增加延迟并继续
        if (error?.response?.status === 429) {
          console.warn('请求过于频繁(429)，延长轮询间隔到15秒')
          await new Promise(resolve => setTimeout(resolve, 15000))
          continue
        }
      }

      if (isPolling) {
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }
  }

  poll()

  // 返回停止轮询的函数
  return () => {
    isPolling = false
  }
}

/**
 * 使用SSE订阅任务状态更新（推荐方式，避免轮询）
 */
export const subscribePreviewTaskStatus = (
  taskId: string,
  onUpdate: (task: PreviewTask) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const eventSource = new EventSource(`/api/preview-tasks/${taskId}/events`)

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'initial' || data.type === 'update') {
        // SSE推送的任务状态更新
        if (data.task) {
          onUpdate(data.task)
        }
      } else if (data.type === 'error') {
        console.error('SSE Error:', data.message)
        if (onError) {
          onError(new Error(data.message))
        }
      }
    } catch (error) {
      console.error('Failed to parse SSE data:', error)
    }
  }

  eventSource.onerror = (error) => {
    console.error('SSE connection error:', error)
    eventSource.close()
    if (onError) {
      onError(new Error('SSE连接失败'))
    }
  }

  // 返回关闭SSE连接的函数
  return () => {
    eventSource.close()
  }
}

/**
 * 停止运行中的任务
 */
export const stopPreviewTask = async (taskId: string): Promise<ApiResponse<void>> => {
  return apiClient.post<ApiResponse<void>>(`/preview-tasks/${taskId}/stop`, {})
}

/**
 * 重启失败的任务
 */
export const restartPreviewTask = async (
  taskId: string
): Promise<ApiResponse<{ taskId: string; status: string }>> => {
  return apiClient.post<ApiResponse<{ taskId: string; status: string }>>(
    `/preview-tasks/${taskId}/restart`,
    {}
  )
}

/**
 * 删除预览任务
 */
export const deletePreviewTask = async (taskId: string): Promise<ApiResponse<void>> => {
  return apiClient.delete<ApiResponse<void>>(`/preview-tasks/${taskId}`)
}
