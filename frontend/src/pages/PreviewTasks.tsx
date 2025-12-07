import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Progress,
  Select,
  Modal,
  message,
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  StopOutlined,
  RedoOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import { getPreviewTasks, stopPreviewTask, restartPreviewTask, deletePreviewTask } from '../services/previewTasks'
import type { PreviewTask } from '../types'

const { Title } = Typography

const PreviewTasks: React.FC = () => {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  const { data, isLoading, refetch } = useQuery(
    ['previewTasks', statusFilter],
    async () => {
      const response = await getPreviewTasks({
        status: statusFilter as any,
        limit: 100,
        offset: 0,
      })
      return response
    },
    {
      // 移除轮询：任务状态更新由 my-agent-test 通过回调自动推送到后端
      // 只在组件挂载时获取一次数据
      refetchOnMount: 'always',
      refetchOnWindowFocus: false, // 禁用窗口聚焦时自动刷新
    }
  )

  const tasks = data?.data || []

  const getStatusIcon = (status: PreviewTask['status']) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ color: '#faad14' }} />
      case 'running':
        return <SyncOutlined spin style={{ color: '#1890ff' }} />
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  const getStatusTag = (status: PreviewTask['status']) => {
    const statusConfig = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '运行中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
    }
    const config = statusConfig[status]
    return (
      <Tag color={config.color} icon={getStatusIcon(status)}>
        {config.text}
      </Tag>
    )
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--'
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getDuration = (task: PreviewTask) => {
    if (!task.start_time) return '--'
    const start = new Date(task.start_time).getTime()
    const end = task.complete_time
      ? new Date(task.complete_time).getTime()
      : Date.now()
    const durationMs = end - start
    const seconds = Math.floor(durationMs / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`
    } else if (minutes > 0) {
      return `${minutes}分钟${seconds % 60}秒`
    } else {
      return `${seconds}秒`
    }
  }

  const handleStopTask = async (taskId: string) => {
    setLoading(true)
    try {
      await stopPreviewTask(taskId)
      message.success('任务已停止')
      refetch()
    } catch (error: any) {
      message.error(error?.response?.data?.message || '停止任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleRestartTask = async (taskId: string) => {
    setLoading(true)
    try {
      await restartPreviewTask(taskId)
      message.success('任务已重启')
      refetch()
    } catch (error: any) {
      message.error(error?.response?.data?.message || '重启任务失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    setLoading(true)
    try {
      await deletePreviewTask(taskId)
      message.success('任务已删除')
      refetch()
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除任务失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
      width: 200,
      render: (text: string) => (
        <span style={{ fontWeight: 500, color: '#d4af37' }}>{text}</span>
      ),
    },
    {
      title: 'Agent',
      dataIndex: 'agent_name',
      key: 'agent_name',
      width: 120,
    },
    {
      title: '阶段',
      dataIndex: 'stage_id',
      key: 'stage_id',
      width: 100,
      render: (stageId: string) => {
        const stageMap: Record<string, { text: string; color: string }> = {
          planning: { text: '策划', color: 'blue' },
          architecture: { text: '架构', color: 'cyan' },
          art: { text: '美术', color: 'magenta' },
          music: { text: '音乐', color: 'orange' },
          tech: { text: '技术', color: 'green' },
          test: { text: '测试', color: 'purple' },
        }
        const config = stageMap[stageId] || { text: stageId, color: 'default' }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: PreviewTask['status']) => getStatusTag(status),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 150,
      render: (progress: number, record: PreviewTask) => {
        const status = record.status === 'failed' ? 'exception' : record.status === 'completed' ? 'success' : 'active'
        return <Progress percent={progress} size="small" status={status} />
      },
    },
    {
      title: '耗时',
      key: 'duration',
      width: 120,
      render: (_: any, record: PreviewTask) => getDuration(record),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => formatDate(date),
    },
    {
      title: '完成时间',
      dataIndex: 'complete_time',
      key: 'complete_time',
      width: 160,
      render: (date?: string) => formatDate(date),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: PreviewTask) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/preview-tasks/${record.task_id}`)}
          >
            查看
          </Button>
          {(record.status === 'running' || record.status === 'pending') && (
            <Button
              type="link"
              danger
              icon={<StopOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认停止任务',
                  content: `确定要停止任务「${record.task_name}」吗？`,
                  okText: '确认停止',
                  okType: 'danger',
                  cancelText: '取消',
                  onOk: () => handleStopTask(record.task_id),
                })
              }}
              loading={loading}
            >
              停止
            </Button>
          )}
          {record.status === 'failed' && (
            <Button
              type="link"
              icon={<RedoOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认重启任务',
                  content: `确定要重启任务「${record.task_name}」吗？`,
                  okText: '确认重启',
                  cancelText: '取消',
                  onOk: () => handleRestartTask(record.task_id),
                })
              }}
              loading={loading}
            >
              重启
            </Button>
          )}
          {(record.status === 'completed' || record.status === 'failed') && (
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '确认删除任务',
                  content: `确定要删除任务「${record.task_name}」吗？此操作不可恢复。`,
                  okText: '确认删除',
                  okType: 'danger',
                  cancelText: '取消',
                  onOk: () => handleDeleteTask(record.task_id),
                })
              }}
              loading={loading}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title level={3} className="!mb-0">
          试运行任务列表
        </Title>
        <Space>
          <Select
            style={{ width: 120 }}
            placeholder="状态筛选"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
          >
            <Select.Option value="pending">等待中</Select.Option>
            <Select.Option value="running">运行中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            刷新
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tasks}
          loading={isLoading}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          scroll={{ x: 1300 }}
        />
      </Card>
    </div>
  )
}

export default PreviewTasks
