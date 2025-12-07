import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { QueryClient, QueryClientProvider } from 'react-query'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Agents from './pages/Agents'
import Games from './pages/Games'
import Market from './pages/Market'
import Community from './pages/Community'
import Profile from './pages/Profile'
import PreviewTasks from './pages/PreviewTasks'
import PreviewTaskDetail from './pages/PreviewTaskDetail'
import ProtectedRoute from './components/ProtectedRoute'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider 
        locale={zhCN}
        theme={{
          token: {
            colorBgElevated: 'rgba(40, 25, 15, 0.95)',
            colorText: '#e8dcc4',
            colorTextHeading: '#d4af37',
            colorSuccess: '#52c41a',
            colorError: '#ff4d4f',
            colorWarning: '#faad14',
            colorInfo: '#1890ff',
            colorSuccessBg: 'rgba(82, 196, 26, 0.2)',
            colorErrorBg: 'rgba(255, 77, 79, 0.2)',
            colorWarningBg: 'rgba(250, 173, 20, 0.2)',
            colorInfoBg: 'rgba(24, 144, 255, 0.2)',
          },
          components: {
            Message: {
              contentBg: 'rgba(40, 25, 15, 0.95)',
              contentPadding: '10px 16px',
              colorText: '#e8dcc4',
              colorSuccess: '#52c41a',
              colorError: '#ff7875',
              colorWarning: '#ffc53d',
              colorInfo: '#40a9ff',
            },
          },
        }}
      >
        <AuthProvider>
          <NotificationProvider>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="companies" element={<Companies />} />
                  <Route path="agents" element={<Agents />} />
                  <Route path="games" element={<Games />} />
                  <Route path="market" element={<Market />} />
                  <Route path="community" element={<Community />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="preview-tasks" element={<PreviewTasks />} />
                  <Route path="preview-tasks/:taskId" element={<PreviewTaskDetail />} />
                </Route>
              </Routes>
            </Router>
          </NotificationProvider>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App