import React from 'react'
import { Outlet } from 'react-router-dom'
import { Layout as AntLayout, Menu } from 'antd'
import { 
  DashboardOutlined, 
  ShopOutlined, 
  RobotOutlined, 
  ShoppingOutlined, 
  MessageOutlined, 
  UserOutlined,
  LogoutOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = AntLayout

const Layout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

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
    <AntLayout className="min-h-screen">
      <Sider width={200} className="bg-white shadow-lg">
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">游戏工厂</h1>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0"
        />
      </Sider>
      <AntLayout>
        <Header className="bg-white shadow-sm px-6 flex items-center justify-between">
          <div className="text-lg font-semibold text-gray-800">
            {menuItems.find(item => item.key === location.pathname)?.label || '游戏工厂'}
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600">欢迎，{user?.username}</span>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
            >
              <LogoutOutlined />
              <span>退出</span>
            </button>
          </div>
        </Header>
        <Content className="m-6 p-6 bg-white rounded-lg shadow-sm">
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout