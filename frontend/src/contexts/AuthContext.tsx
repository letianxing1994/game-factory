import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '../types'
import { api } from '../services/api'

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (username: string, email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token')
      if (storedToken) {
        try {
          const response = await api.get('/auth/me')
          if (response.data.success) {
            setUser(response.data.data)
            setToken(storedToken)
          } else {
            localStorage.removeItem('token')
            setToken(null)
          }
        } catch (error) {
          localStorage.removeItem('token')
          setToken(null)
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { username, password })
      if (response.data.success) {
        const { user, token } = response.data.data
        setUser(user)
        setToken(token)
        localStorage.setItem('token', token)
        
        // 增加登录次数
        const loginCount = parseInt(localStorage.getItem('loginCount') || '0')
        localStorage.setItem('loginCount', String(loginCount + 1))
      } else {
        throw new Error(response.data.message || '登录失败')
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || '登录失败')
    }
  }

  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { username, email, password })
      if (response.data.success) {
        const { user, token } = response.data.data
        setUser(user)
        setToken(token)
        localStorage.setItem('token', token)
        
        // 首次注册，设置登录次数为1
        localStorage.setItem('loginCount', '1')
      } else {
        throw new Error(response.data.message || '注册失败')
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || '注册失败')
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      register,
    }}>
      {children}
    </AuthContext.Provider>
  )
}