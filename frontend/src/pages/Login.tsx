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
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 30%, rgba(255, 120, 60, 0.25) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(220, 100, 40, 0.25) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(40, 25, 15, 0.8) 0%, transparent 100%), linear-gradient(180deg, #2a1810 0%, #3d2418 20%, #2f1810 40%, #3a2015 60%, #2a1810 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 浮动文字 - 上下并排 */}
      <div style={{
        position: 'absolute',
        top: '120px',
        right: '80px',
        fontSize: '26px',
        fontWeight: 700,
        color: '#FFD76E',
        textShadow: '0 0 20px rgba(255,193,7,0.8), 0 0 40px rgba(255,215,0,0.6)',
        animation: 'float1 4s ease-in-out infinite',
        zIndex: 10,
        pointerEvents: 'none',
        letterSpacing: '0.1em'
      }}>
        在游戏中感受创造的神奇
      </div>

      <div style={{
        position: 'absolute',
        top: '170px',
        right: '80px',
        fontSize: '26px',
        fontWeight: 700,
        color: '#FFD76E',
        textShadow: '0 0 20px rgba(255,193,7,0.8), 0 0 40px rgba(255,215,0,0.6)',
        animation: 'float2 4s ease-in-out infinite',
        animationDelay: '2s',
        zIndex: 10,
        pointerEvents: 'none',
        letterSpacing: '0.1em'
      }}>
        在创造后体验游戏的乐趣
      </div>

      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 0.9; }
          50% { transform: translateX(-50%) translateY(-15px); opacity: 1; }
        }
        @keyframes float2 {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 1; }
          50% { transform: translateX(-50%) translateY(-15px); opacity: 0.9; }
        }
      `}</style>

      <div style={{ width: '100%', maxWidth: '500px', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: 700,
            color: '#FFD76E',
            textShadow: '0 0 10px rgba(255,193,7,0.5), 0 4px 8px rgba(0,0,0,0.8)',
            marginBottom: '12px',
            letterSpacing: '0.08em'
          }}>🎮 游戏工厂</h1>
          <p style={{
            fontSize: '16px',
            color: '#e8c468',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)'
          }}>创建你的游戏开发帝国</p>
        </div>
        
        <Card style={{
          background: 'linear-gradient(180deg, rgba(50,35,25,0.98) 0%, rgba(40,28,20,0.99) 100%)',
          border: '2px solid rgba(200,140,80,0.4)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 60px rgba(255,140,60,0.2)'
        }}>
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab} 
            centered
          >
            <TabPane tab={<span style={{ color: '#e8c468', fontSize: '16px' }}>登录</span>} key="login">
              <Form
                name="login"
                onFinish={handleLogin}
                size="large"
                style={{ marginTop: '16px' }}
              >
                <Form.Item
                  name="username"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input 
                    prefix={<UserOutlined style={{ color: '#d4af37' }} />} 
                    placeholder="用户名"
                    style={{
                      background: 'rgba(80,50,30,0.5)',
                      border: '1px solid rgba(200,140,80,0.3)',
                      color: '#e8c468',
                      fontSize: '15px'
                    }}
                  />
                </Form.Item>
                
                <Form.Item
                  name="password"
                  rules={[{ required: true, message: '请输入密码' }]}
                >
                  <Input.Password 
                    prefix={<LockOutlined style={{ color: '#d4af37' }} />} 
                    placeholder="密码"
                    style={{
                      background: 'rgba(80,50,30,0.5)',
                      border: '1px solid rgba(200,140,80,0.3)',
                      color: '#e8c468',
                      fontSize: '15px'
                    }}
                  />
                </Form.Item>
                
                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    style={{
                      width: '100%',
                      height: '45px',
                      fontSize: '16px',
                      background: 'linear-gradient(135deg, rgba(255,180,100,0.9), rgba(200,120,60,0.9))',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(255,140,60,0.4)',
                      fontWeight: 600
                    }}
                  >
                    登录
                  </Button>
                </Form.Item>
              </Form>
            </TabPane>
            
            <TabPane tab={<span style={{ color: '#e8c468', fontSize: '16px' }}>注册</span>} key="register">
              <Form
                name="register"
                onFinish={handleRegister}
                size="large"
                style={{ marginTop: '16px' }}
              >
                <Form.Item
                  name="username"
                  rules={[{ required: true, message: '请输入用户名' }]}
                >
                  <Input 
                    prefix={<UserOutlined style={{ color: '#d4af37' }} />} 
                    placeholder="用户名"
                    style={{
                      background: 'rgba(80,50,30,0.5)',
                      border: '1px solid rgba(200,140,80,0.3)',
                      color: '#e8c468',
                      fontSize: '15px'
                    }}
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
                    prefix={<MailOutlined style={{ color: '#d4af37' }} />} 
                    placeholder="邮箱"
                    style={{
                      background: 'rgba(80,50,30,0.5)',
                      border: '1px solid rgba(200,140,80,0.3)',
                      color: '#e8c468',
                      fontSize: '15px'
                    }}
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
                    prefix={<LockOutlined style={{ color: '#d4af37' }} />} 
                    placeholder="密码"
                    style={{
                      background: 'rgba(80,50,30,0.5)',
                      border: '1px solid rgba(200,140,80,0.3)',
                      color: '#e8c468',
                      fontSize: '15px'
                    }}
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
                    prefix={<LockOutlined style={{ color: '#d4af37' }} />} 
                    placeholder="确认密码"
                    style={{
                      background: 'rgba(80,50,30,0.5)',
                      border: '1px solid rgba(200,140,80,0.3)',
                      color: '#e8c468',
                      fontSize: '15px'
                    }}
                  />
                </Form.Item>
                
                <Form.Item>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    style={{
                      width: '100%',
                      height: '45px',
                      fontSize: '16px',
                      background: 'linear-gradient(135deg, rgba(255,180,100,0.9), rgba(200,120,60,0.9))',
                      border: 'none',
                      boxShadow: '0 4px 12px rgba(255,140,60,0.4)',
                      fontWeight: 600
                    }}
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
