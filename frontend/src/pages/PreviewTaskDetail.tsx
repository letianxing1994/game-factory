import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Progress,
  Button,
  Space,
  Alert,
  Typography,
  Spin,
  Result,
  Divider,
  Timeline,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import { pollPreviewTaskStatus } from '../services/previewTasks'
import type { PreviewTask } from '../types'

const { Title, Text } = Typography

const PreviewTaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [task, setTask] = useState<PreviewTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return

    let stopPolling: (() => void) | undefined

    const startPolling = async () => {
      try {
        stopPolling = await pollPreviewTaskStatus(taskId, (updatedTask) => {
          setTask(updatedTask)
          setLoading(false)
        })
      } catch (err: any) {
        setError(err.message || '加载任务失败')
        setLoading(false)
      }
    }

    startPolling()

    // 清理：组件卸载时停止轮询
    return () => {
      if (stopPolling) {
        stopPolling()
      }
    }
  }, [taskId])

  const getStatusIcon = (status?: PreviewTask['status']) => {
    switch (status) {
      case 'pending':
        return <ClockCircleOutlined style={{ fontSize: 48, color: '#faad14' }} />
      case 'running':
        return <SyncOutlined spin style={{ fontSize: 48, color: '#1890ff' }} />
      case 'completed':
        return <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
      default:
        return null
    }
  }

  const getStatusTag = (status?: PreviewTask['status']) => {
    if (!status) return null
    const statusConfig = {
      pending: { color: 'default', text: '等待中' },
      running: { color: 'processing', text: '运行中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
    }
    const config = statusConfig[status]
    return <Tag color={config.color}>{config.text}</Tag>
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
      second: '2-digit',
    })
  }

  const getProgressSteps = (task: PreviewTask) => {
    const steps = []

    if (task.status === 'pending') {
      steps.push({ status: 'wait', title: '等待执行', time: task.created_at })
    } else {
      steps.push({ status: 'finish', title: '任务创建', time: task.created_at })
    }

    if (task.start_time) {
      steps.push({ status: 'finish', title: '开始执行', time: task.start_time })
    }

    if (task.status === 'running') {
      const progressText = `执行中 (${task.progress}%)`
      steps.push({ status: 'process', title: progressText, time: new Date().toISOString() })
    }

    if (task.status === 'completed') {
      steps.push({ status: 'finish', title: '执行完成', time: task.complete_time })
    } else if (task.status === 'failed') {
      steps.push({ status: 'error', title: '执行失败', time: task.complete_time })
    }

    return steps
  }

  const renderResultData = (resultData: any) => {
    if (!resultData) return null

    // 如果是GDD产物
    if (resultData.artifactType === 'gdd' && resultData.gdd) {
      return (
        <Card size="small" title="GDD (游戏设计文档)">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="项目名称">
              {resultData.gdd.projectName || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="核心概念">
              {resultData.gdd.coreConcept || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="游戏类型">
              {resultData.gdd.gameType || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="主流派">
              {resultData.gdd.primaryGenre || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="维度">
              {resultData.gdd.dimension || '--'}
            </Descriptions.Item>
            <Descriptions.Item label="美术风格">
              {resultData.gdd.artStyle || '--'}
            </Descriptions.Item>
          </Descriptions>
          {resultData.artifactUrl && (
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href={`http://localhost:3000${resultData.artifactUrl}`}
                target="_blank"
              >
                下载完整GDD文档
              </Button>
            </div>
          )}
        </Card>
      )
    }

    // 其他类型的产物
    return (
      <Card size="small" title="任务结果">
        <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
          {JSON.stringify(resultData, null, 2)}
        </pre>
      </Card>
    )
  }

  if (loading && !task) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载任务信息..." />
      </div>
    )
  }

  if (error || !task) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error || '任务不存在'}
        extra={
          <Button type="primary" onClick={() => navigate('/preview-tasks')}>
            返回任务列表
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/preview-tasks')}>
            返回
          </Button>
          <Title level={3} className="!mb-0">
            任务详情
          </Title>
        </Space>
      </div>

      {/* 任务状态概览 */}
      <Card>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {getStatusIcon(task.status)}
          <div style={{ marginTop: 16 }}>
            <Title level={4} style={{ marginBottom: 8 }}>
              {task.task_name}
            </Title>
            <Space size="large">
              {getStatusTag(task.status)}
              <Text type="secondary">Agent: {task.agent_name}</Text>
              <Text type="secondary">阶段: {task.stage_id}</Text>
            </Space>
          </div>
        </div>

        <Divider />

        {/* 进度条 */}
        {task.status !== 'pending' && (
          <div style={{ marginBottom: 24 }}>
            <Text strong>执行进度</Text>
            <Progress
              percent={task.progress}
              status={
                task.status === 'failed'
                  ? 'exception'
                  : task.status === 'completed'
                  ? 'success'
                  : 'active'
              }
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
            {task.status === 'running' && (
              <Alert
                message="任务正在执行中，页面会自动刷新进度"
                type="info"
                showIcon
                style={{ marginTop: 8 }}
              />
            )}
          </div>
        )}

        {/* 执行时间线 */}
        <div style={{ marginTop: 24 }}>
          <Text strong>执行时间线</Text>
          <Timeline style={{ marginTop: 16 }}>
            {getProgressSteps(task).map((step, index) => (
              <Timeline.Item
                key={index}
                color={
                  step.status === 'finish'
                    ? 'green'
                    : step.status === 'process'
                    ? 'blue'
                    : step.status === 'error'
                    ? 'red'
                    : 'gray'
                }
              >
                <p style={{ marginBottom: 4 }}>{step.title}</p>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDate(step.time)}
                </Text>
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
      </Card>

      {/* 任务详细信息 */}
      <Card title="任务信息">
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="任务ID">{task.task_id}</Descriptions.Item>
          <Descriptions.Item label="Agent ID">{task.agent_id}</Descriptions.Item>
          <Descriptions.Item label="Agent名称">{task.agent_name || '--'}</Descriptions.Item>
          <Descriptions.Item label="执行阶段">{task.stage_id}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatDate(task.created_at)}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{formatDate(task.start_time)}</Descriptions.Item>
          <Descriptions.Item label="完成时间">{formatDate(task.complete_time)}</Descriptions.Item>
          <Descriptions.Item label="状态">{getStatusTag(task.status)}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 错误信息 */}
      {task.status === 'failed' && task.error_message && (
        <Alert
          message="执行失败"
          description={task.error_message}
          type="error"
          showIcon
        />
      )}

      {/* 任务配置 */}
      {task.config && (
        <Card title="任务配置">
          <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
            {JSON.stringify(task.config, null, 2)}
          </pre>
        </Card>
      )}

      {/* 任务结果 */}
      {task.status === 'completed' && task.result_data && (
        <div>{renderResultData(task.result_data)}</div>
      )}
    </div>
  )
}

export default PreviewTaskDetail
