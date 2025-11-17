import axios from 'axios'
import { message } from 'antd'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      message.error('登录已过期，请重新登录')
    } else if (error.response?.status === 403) {
      message.error('没有权限访问')
    } else if (error.response?.status >= 500) {
      message.error('服务器错误，请稍后重试')
    }
    return Promise.reject(error)
  }
)

// 通用的API方法
export const apiClient = {
  get: <T>(url: string, params?: any) => 
    api.get<T>(url, { params }).then(response => response.data),
  
  post: <T>(url: string, data?: any) => 
    api.post<T>(url, data).then(response => response.data),
  
  put: <T>(url: string, data?: any) => 
    api.put<T>(url, data).then(response => response.data),
  
  delete: <T>(url: string) => 
    api.delete<T>(url).then(response => response.data),
}