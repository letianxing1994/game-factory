import React from 'react'
import { Modal, List, Button, Empty, Space, Tag, Typography } from 'antd'
import { ExclamationCircleOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../contexts/NotificationContext'

const { Text, Paragraph } = Typography

const NotificationModal: React.FC = () => {
  const navigate = useNavigate()
  const { notifications, unreadCount, isModalVisible, closeModal, removeNotification, clearAllNotifications } = useNotifications()

  const handleTaskClick = (taskId: string) => {
    // 跳转到任务详情页
    navigate(`/preview-tasks/${taskId}`)
    // 移除该通知
    removeNotification(taskId)
    // 关闭模态框
    closeModal()
  }

  const handleRemoveNotification = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removeNotification(taskId)
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = Math.floor((now.getTime() - timestamp.getTime()) / 1000) // 秒

    if (diff < 60) {
      return '刚刚'
    } else if (diff < 3600) {
      return `${Math.floor(diff / 60)} 分钟前`
    } else if (diff < 86400) {
      return `${Math.floor(diff / 3600)} 小时前`
    } else {
      return `${Math.floor(diff / 86400)} 天前`
    }
  }

  return (
    <Modal
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>等待输入的任务</span>
            {unreadCount > 0 && (
              <Tag color="error">{unreadCount} 个</Tag>
            )}
          </Space>
          {notifications.length > 0 && (
            <Button
              type="link"
              size="small"
              icon={<DeleteOutlined />}
              onClick={clearAllNotifications}
              danger
            >
              清空全部
            </Button>
          )}
        </div>
      }
      open={isModalVisible}
      onCancel={closeModal}
      footer={null}
      width={600}
      bodyStyle={{ maxHeight: '500px', overflowY: 'auto', padding: 0 }}
    >
      {notifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无任务等待输入"
          style={{ padding: '40px 0' }}
        />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(notification) => (
            <List.Item
              key={notification.taskId}
              style={{
                cursor: 'pointer',
                padding: '16px 24px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'background 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(24, 144, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              onClick={() => handleTaskClick(notification.taskId)}
              actions={[
                <Button
                  key="remove"
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={(e) => handleRemoveNotification(notification.taskId, e)}
                  danger
                />,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <ExclamationCircleOutlined
                    style={{
                      fontSize: '32px',
                      color: '#ff4d4f',
                    }}
                  />
                }
                title={
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Text strong style={{ fontSize: '16px' }}>
                      {notification.taskName}
                    </Text>
                    {notification.agentName && (
                      <Text type="secondary" style={{ fontSize: '13px' }}>
                        Agent: {notification.agentName}
                      </Text>
                    )}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={8} style={{ width: '100%', marginTop: 8 }}>
                    {notification.question && (
                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{
                          marginBottom: 0,
                          color: 'rgba(255, 255, 255, 0.7)',
                          fontSize: '14px',
                        }}
                      >
                        {notification.question}
                      </Paragraph>
                    )}
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatTimestamp(notification.timestamp)}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Modal>
  )
}

export default NotificationModal
