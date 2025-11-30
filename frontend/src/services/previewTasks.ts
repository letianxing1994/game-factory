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
 */
export const pollPreviewTaskStatus = async (
  taskId: string,
  onUpdate: (task: PreviewTask) => void,
  interval: number = 2000
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
      } catch (error) {
        console.error('Failed to poll task status:', error)
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
