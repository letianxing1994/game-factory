import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Layout as AntLayout, Menu } from 'antd'
import { 
  DashboardOutlined, 
  ShopOutlined, 
  RobotOutlined,
  PlaySquareOutlined,
  ShoppingOutlined, 
  MessageOutlined, 
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import SailorMoonGuide from './SailorMoonGuide'

const { Header, Sider, Content } = AntLayout

const Layout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  
  // 从 localStorage 恢复侧边栏状态
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })
  
  // 切换侧边栏状态
  const toggleSidebar = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))
  }

  useEffect(() => {
    // 检查是否是首次登录
    const loginCount = localStorage.getItem('loginCount')
    if (!loginCount || loginCount === '1') {
      // setIsFirstLogin(true) // 暂时注释，以后可能会用到
    }
  }, [])

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/companies',
      icon: <ShopOutlined />,
      label: '公司管理',
    },
    {
      key: '/agents',
      icon: <RobotOutlined />,
      label: '员工Agent',
    },
    {
      key: '/games',
      icon: <PlaySquareOutlined />,
      label: '游戏中心',
    },
    {
      key: '/market',
      icon: <ShoppingOutlined />,
      label: '市场',
    },
    {
      key: '/community',
      icon: <MessageOutlined />,
      label: '社区',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <AntLayout className="min-h-screen" style={{ minHeight: '100vh' }}>
      <Sider 
        width={280}
        collapsedWidth={80}
        collapsed={collapsed}
        style={{ 
          minHeight: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          overflow: 'auto',
          transition: 'all 0.2s ease'
        }}
      >
        <div className="h-20 flex items-center justify-center border-b" style={{
          background: 'linear-gradient(180deg, rgba(80, 50, 30, 0.95) 0%, rgba(50, 30, 20, 0.98) 100%)',
          borderBottom: '2px solid rgba(200, 140, 80, 0.5)'
        }}>
          {!collapsed ? (
            <h1 style={{
              fontSize: '26px',
              fontWeight: 700,
              color: '#fff5e6',
              textShadow: '0 3px 8px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 180, 100, 0.5)',
              letterSpacing: '0.08em'
            }}>🎮 游戏工厂</h1>
          ) : (
            <h1 style={{
              fontSize: '28px',
              color: '#fff5e6',
              textShadow: '0 3px 8px rgba(0, 0, 0, 0.9)'
            }}>🎮</h1>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0"
          style={{ 
            height: 'calc(100vh - 80px)',
            borderRight: 0,
            paddingTop: '20px',
            fontSize: '16px'
          }}
          inlineCollapsed={collapsed}
        />
      </Sider>
      <AntLayout style={{ marginLeft: collapsed ? 80 : 280, transition: 'margin-left 0.2s ease' }}>
        <Header style={{ 
          position: 'sticky',
          top: 0,
          zIndex: 10,
          width: '100%',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={toggleSidebar}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#fff5e6',
                fontSize: '18px',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
              }}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </button>
            <div style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#fff5e6',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
            }}>
              {menuItems.find(item => item.key === location.pathname)?.label || '游戏工厂'}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span style={{ color: '#e8c468' }}>欢迎，{user?.username}</span>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2"
              style={{ 
                color: '#e8c468',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              <LogoutOutlined />
              <span>退出</span>
            </button>
          </div>
        </Header>
        <Content style={{ 
          margin: '24px',
          padding: '32px',
          minHeight: 'calc(100vh - 112px)',
          overflow: 'auto'
        }}>
          <Outlet />
        </Content>
      </AntLayout>
      
      {/* 水冰月引导组件 */}
      <SailorMoonGuide />
    </AntLayout>
  )
}

export default Layout