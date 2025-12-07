import React from 'react'
import { Badge, Button, Tooltip } from 'antd'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { useNotifications } from '../contexts/NotificationContext'

const NotificationButton: React.FC = () => {
  const { unreadCount, openModal } = useNotifications()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '40px',
        right: '40px',
        zIndex: 1000,
      }}
    >
      <Tooltip title={unreadCount > 0 ? `${unreadCount} 个任务等待您的输入` : '暂无通知'} placement="left">
        <Badge count={unreadCount} offset={[-5, 5]} overflowCount={99}>
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<ExclamationCircleOutlined style={{ fontSize: '28px' }} />}
            onClick={openModal}
            style={{
              width: '64px',
              height: '64px',
              boxShadow: '0 4px 12px rgba(24, 144, 255, 0.4)',
              background: unreadCount > 0
                ? 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 100%)'
                : 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
              border: 'none',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)'
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(24, 144, 255, 0.6)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.4)'
            }}
          />
        </Badge>
      </Tooltip>
    </div>
  )
}

export default NotificationButton
