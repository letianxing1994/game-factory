import React, { useState } from 'react'
import { Form, Input, Button, Card, message, Tabs } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

const { TabPane } = Tabs

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await login(values.username, values.password)
      message.success('登录成功')
      navigate('/')
    } catch (error: any) {
      message.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (values: { 
    username: string; 
    email: string; 
    password: string; 
    confirmPassword: string 
  }) => {
    setLoading(true)
    try {
      if (values.password !== values.confirmPassword) {
        message.error('两次输入的密码不一致')
        return
      }
      await register(values.username, values.email, values.password)
      message.success('注册成功')
      setActiveTab('login')
    } catch (error: any) {
      message.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">游戏工厂</h1>
          <p className="text-gray-600">创建你的游戏开发帝国</p>
        </div>
        
        <Card className="shadow-xl">
          <Tabs activeKey={activeTab} onChange={setActiveTab} centered>
            <TabPane tab="登录" key="login">
              <Form
                name="login"
                onFinish={handleLogin}
                size="large"
                className="mt-4"
              >
                <Form.Item
                  name="username"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input 
                    prefix={<UserOutlined />} 
                    placeholder="用户名" 
                  />
                </Form.Item>
                
                <Form.Item
                  name="password"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password 
                    prefix={<LockOutlined />} 
                    placeholder="密码" 
                  />
                </Form.Item>
                
                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    className="w-full"
                  >
                    登录
                  </Button>
                </Form.Item>
              </Form>
            </TabPane>
            
            <TabPane tab="注册" key="register">
              <Form
                name="register"
                onFinish={handleRegister}
                size="large"
                className="mt-4"
              >
                <Form.Item
                  name="username"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input 
                    prefix={<UserOutlined />} 
                    placeholder="用户名" 
                  />
                </Form.Item>
                
                <Form.Item
                  name="email"
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { type: 'email', message: '请输入有效的邮箱地址' }
                  ]}
                >
                  <Input 
                    prefix={<MailOutlined />} 
                    placeholder="邮箱" 
                  />
                </Form.Item>
                
                <Form.Item
                  name="password"
                  rules={[
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码至少6位' }
                  ]}
                >
                  <Input.Password 
                    prefix={<LockOutlined />} 
                    placeholder="密码" 
                  />
                </Form.Item>
                
                <Form.Item
                  name="confirmPassword"
                  rules={[
                    { required: true, message: '请确认密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve()
                        }
                        return Promise.reject(new Error('两次输入的密码不一致'))
                      },
                    }),
                  ]}
                >
                  <Input.Password 
                    prefix={<LockOutlined />} 
                    placeholder="确认密码" 
                  />
                </Form.Item>
                
                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    className="w-full"
                  >
                    注册
                  </Button>
                </Form.Item>
              </Form>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

export default Login