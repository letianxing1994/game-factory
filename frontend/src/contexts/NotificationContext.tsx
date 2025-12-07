import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { getPreviewTasks } from '../services/previewTasks'

export interface TaskNotification {
  taskId: string
  taskName: string
  agentName?: string
  question?: string
  timestamp: Date
}

interface NotificationContextType {
  notifications: TaskNotification[]
  unreadCount: number
  addNotification: (notification: TaskNotification) => void
  removeNotification: (taskId: string) => void
  clearAllNotifications: () => void
  isModalVisible: boolean
  openModal: () => void
  closeModal: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

interface NotificationProviderProps {
  children: ReactNode
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<TaskNotification[]>([])
  const [isModalVisible, setIsModalVisible] = useState(false)

  const unreadCount = notifications.length

  // 添加通知
  const addNotification = useCallback((notification: TaskNotification) => {
    setNotifications((prev) => {
      // 避免重复通知
      const exists = prev.find((n) => n.taskId === notification.taskId)
      if (exists) {
        return prev
      }
      return [...prev, notification]
    })
  }, [])

  // 移除通知
  const removeNotification = useCallback((taskId: string) => {
    setNotifications((prev) => prev.filter((n) => n.taskId !== taskId))
  }, [])

  // 清空所有通知
  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // 打开/关闭模态框
  const openModal = useCallback(() => {
    setIsModalVisible(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsModalVisible(false)
  }, [])

  // 全局SSE监听：订阅所有任务的user_input_required事件
  useEffect(() => {
    // 设置全局SSE监听
    let eventSource: EventSource | null = null

    const setupGlobalSSE = () => {
      try {
        // 连接到全局任务事件端点
        eventSource = new EventSource('/api/preview-tasks/events/global')

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            // 监听用户输入请求事件
            if (data.type === 'user_input_required') {
              console.log('[NotificationContext] 收到全局user_input_required事件:', data)
              addNotification({
                taskId: data.taskId,
                taskName: data.taskName || '未命名任务',
                agentName: data.agentName,
                question: data.question,
                timestamp: new Date(),
              })
            }
          } catch (error) {
            console.error('[NotificationContext] 解析SSE数据失败:', error)
          }
        }

        eventSource.onerror = (error) => {
          console.error('[NotificationContext] SSE连接错误:', error)
          eventSource?.close()

          // 5秒后重连
          setTimeout(() => {
            console.log('[NotificationContext] 尝试重新连接SSE...')
            setupGlobalSSE()
          }, 5000)
        }
      } catch (error) {
        console.error('[NotificationContext] 创建SSE连接失败:', error)
      }
    }

    setupGlobalSSE()

    // 清理：组件卸载时关闭SSE连接
    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [addNotification])

  // 初始加载：检查是否有正在等待用户输入的任务
  useEffect(() => {
    const checkExistingTasks = async () => {
      try {
        const response = await getPreviewTasks({ status: 'running' })
        if (response.success && response.data) {
          // 检查是否有任务正在等待用户输入
          // 这里暂时不添加通知，因为我们依赖SSE实时推送
          // 如果需要，可以在任务详情API中返回是否等待用户输入的标志
        }
      } catch (error) {
        console.error('[NotificationContext] 检查现有任务失败:', error)
      }
    }

    checkExistingTasks()
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        removeNotification,
        clearAllNotifications,
        isModalVisible,
        openModal,
        closeModal,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}
