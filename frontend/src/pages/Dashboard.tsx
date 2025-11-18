import React from 'react'
import { Row, Col, Card, Statistic, Progress, List, Avatar } from 'antd'
import { 
  ShopOutlined, 
  RobotOutlined, 
  DollarOutlined, 
  TeamOutlined,
  RiseOutlined,
  TrophyOutlined
} from '@ant-design/icons'
import { useQuery } from 'react-query'
import { useNavigate } from 'react-router-dom'
import { apiClient } from '../services/api'

interface UserStats {
  companies: number;
  agents: number;
  balance: number;
  reputation: number;
}

interface ActivityItem {
  id: number;
  type: string;
  title: string;
  time: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  
  // 获取用户统计数据
  const { data: statsResponse } = useQuery<{ success: boolean; data: any }>('userStats', () => 
    apiClient.get<{ success: boolean; data: any }>('/users/stats')
  )

  // 获取最近活动
  const { data: activitiesResponse } = useQuery<{ success: boolean; data: ActivityItem[] }>('recentActivities', () => 
    apiClient.get<{ success: boolean; data: ActivityItem[] }>('/users/activities')
  )

  const mockStats: UserStats = {
    companies: 3,
    agents: 12,
    balance: 15000,
    reputation: 85,
  }

  const mockActivities: ActivityItem[] = [
    {
      id: 1,
      type: 'company_created',
      title: '创建了新公司 "游戏工作室"',
      time: '2小时前',
    },
    {
      id: 2,
      type: 'agent_hired',
      title: '雇佣了开发者 "小明"',
      time: '5小时前',
    },
    {
      id: 3,
      type: 'game_published',
      title: '发布了游戏 "太空冒险"',
      time: '1天前',
    },
  ]

  // 从后端API响应中提取数据
  const apiStats = statsResponse?.success ? statsResponse.data : null
  const stats: UserStats = apiStats ? {
    companies: apiStats.companies?.total_companies ?? 0,
    agents: apiStats.agents?.total ?? 0,
    balance: apiStats.user?.game_coins ?? 0,
    reputation: apiStats.user?.reputation ?? 0,
  } : mockStats
  
  // 转换活动数据格式
  const apiActivities = activitiesResponse?.success && Array.isArray(activitiesResponse.data) 
    ? activitiesResponse.data.map((item: any) => ({
        id: item.reference_id,
        type: item.type,
        title: item.description || '活动记录',
        time: item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '未知时间'
      }))
    : null
  
  const activityFeed = apiActivities ?? mockActivities

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'company_created':
        return <ShopOutlined className="text-blue-500" />
      case 'agent_hired':
        return <TeamOutlined className="text-green-500" />
      case 'game_published':
        return <TrophyOutlined className="text-yellow-500" />
      default:
        return <RiseOutlined className="text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-2xl font-bold text-gray-800 mb-6">仪表盘</div>
      
      {/* 统计卡片 */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="公司数量"
              value={stats.companies}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="员工数量"
              value={stats.agents}
              prefix={<RobotOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="账户余额"
              value={stats.balance}
              prefix={<DollarOutlined />}
              precision={2}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="声誉值"
              value={stats.reputation}
              suffix="/ 100"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* 公司概览 */}
        <Col span={12}>
          <Card title="公司概览" className="h-80">
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>总体进度</span>
                  <span>75%</span>
                </div>
                <Progress percent={75} strokeColor="#52c41a" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>员工满意度</span>
                  <span>82%</span>
                </div>
                <Progress percent={82} strokeColor="#1890ff" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>项目完成率</span>
                  <span>90%</span>
                </div>
                <Progress percent={90} strokeColor="#722ed1" />
              </div>
            </div>
          </Card>
        </Col>

        {/* 最近活动 */}
        <Col span={12}>
          <Card title="最近活动" className="h-80">
            <List
              dataSource={activityFeed}
              renderItem={(item: ActivityItem) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={getActivityIcon(item.type)} />}
                    title={item.title}
                    description={item.time}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作 */}
      <Card title="快速操作">
        <Row gutter={16}>
          <Col span={6}>
            <Card hoverable className="text-center cursor-pointer" onClick={() => navigate('/companies')}>
              <ShopOutlined className="text-2xl text-blue-500 mb-2" />
              <div className="font-semibold">创建公司</div>
              <div className="text-sm text-gray-500">开始你的游戏开发之旅</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable className="text-center cursor-pointer" onClick={() => navigate('/agents')}>
              <RobotOutlined className="text-2xl text-green-500 mb-2" />
              <div className="font-semibold">雇佣员工</div>
              <div className="text-sm text-gray-500">招募优秀的开发团队</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable className="text-center cursor-pointer" onClick={() => navigate('/companies')}>
              <TrophyOutlined className="text-2xl text-yellow-500 mb-2" />
              <div className="font-semibold">发布游戏</div>
              <div className="text-sm text-gray-500">展示你的游戏作品</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable className="text-center cursor-pointer" onClick={() => navigate('/market')}>
              <RiseOutlined className="text-2xl text-purple-500 mb-2" />
              <div className="font-semibold">市场趋势</div>
              <div className="text-sm text-gray-500">了解行业趋势</div>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default Dashboard