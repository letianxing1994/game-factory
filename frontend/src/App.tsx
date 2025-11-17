import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { QueryClient, QueryClientProvider } from 'react-query'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Companies from './pages/Companies'
import Agents from './pages/Agents'
import Market from './pages/Market'
import Community from './pages/Community'
import Profile from './pages/Profile'
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
      <ConfigProvider locale={zhCN}>
        <AuthProvider>
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
                <Route path="market" element={<Market />} />
                <Route path="community" element={<Community />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  )
}

export default App