import React, { useState } from 'react'
import { Card, Row, Col, Typography, Button, Tag, Modal, Tabs, Empty, Spin, message } from 'antd'
import { 
  DownloadOutlined, 
  PlayCircleOutlined, 
  EyeOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  FireOutlined,
  StarOutlined
} from '@ant-design/icons'
import { useQuery } from 'react-query'
import { api } from '../services/api'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

interface Game {
  id: number
  name: string
  genre: string
  description: string
  company_id: number
  company_name?: string
  game_file_url?: string
  game_file_type?: string
  version: string
  development_status: string
  quality_score: number
  popularity_score: number
  downloads_count: number
  play_count: number
  created_at: string
  released_at?: string
}

const Games: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [previewModalVisible, setPreviewModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('top')

  // 获取Top10游戏
  const { data: topGames, isLoading: topLoading } = useQuery<Game[]>(
    'topGames',
    async () => {
      const response = await api.get('/games?sort=popularity&limit=10')
      return response.data.data || []
    }
  )

  // 获取最新游戏
  const { data: latestGames, isLoading: latestLoading } = useQuery<Game[]>(
    'latestGames',
    async () => {
      const response = await api.get('/games?sort=created_at&limit=20')
      return response.data.data || []
    }
  )

  // 获取我的公司游戏
  const { data: myGames, isLoading: myLoading } = useQuery<Game[]>(
    'myGames',
    async () => {
      const response = await api.get('/games/my-company')
      return response.data.data || []
    }
  )

  const handleDownload = (game: Game) => {
    if (!game.game_file_url) {
      message.warning('游戏文件尚未上传')
      return
    }
    window.open(game.game_file_url, '_blank')
    message.success('开始下载...')
  }

  const handlePreview = (game: Game) => {
    setSelectedGame(game)
    setPreviewModalVisible(true)
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'developing': 'blue',
      'testing': 'orange',
      'released': 'green',
      'archived': 'default'
    }
    return colors[status] || 'default'
  }

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'developing': '开发中',
      'testing': '测试中',
      'released': '已发布',
      'archived': '已归档'
    }
    return texts[status] || status
  }

  const renderGameCard = (game: Game) => (
    <Card
      hoverable
      style={{
        height: '100%',
        background: 'linear-gradient(135deg, rgba(40, 25, 15, 0.95) 0%, rgba(30, 20, 15, 0.98) 100%)',
        border: '1px solid rgba(200, 140, 80, 0.3)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.6)'
      }}
      cover={
        <div style={{
          height: '160px',
          background: `linear-gradient(135deg, 
            rgba(255, ${Math.floor(Math.random() * 100 + 100)}, ${Math.floor(Math.random() * 100)}, 0.8),
            rgba(${Math.floor(Math.random() * 100)}, ${Math.floor(Math.random() * 100 + 100)}, 255, 0.8))`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <div style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)'
          }}>
            🎮
          </div>
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'flex',
            gap: '8px'
          }}>
            <Tag color={getStatusColor(game.development_status)}>
              {getStatusText(game.development_status)}
            </Tag>
            {game.quality_score >= 80 && (
              <Tag color="gold" icon={<StarOutlined />}>精品</Tag>
            )}
          </div>
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            display: 'flex',
            gap: '12px',
            fontSize: '12px',
            color: 'white'
          }}>
            <span><EyeOutlined /> {game.play_count || 0}</span>
            <span><DownloadOutlined /> {game.downloads_count || 0}</span>
          </div>
        </div>
      }
    >
      <div style={{ minHeight: '180px', display: 'flex', flexDirection: 'column' }}>
        <Title level={4} style={{ 
          color: '#FFD76E', 
          marginBottom: '8px',
          fontSize: '18px'
        }}>
          {game.name}
        </Title>
        
        <div style={{ marginBottom: '8px' }}>
          <Tag color="volcano">{game.genre}</Tag>
          <Tag color="cyan">v{game.version}</Tag>
        </div>

        {game.company_name && (
          <Text style={{ color: '#c8a060', fontSize: '13px', marginBottom: '8px' }}>
            <TeamOutlined /> {game.company_name}
          </Text>
        )}

        <Paragraph 
          ellipsis={{ rows: 2 }}
          style={{ 
            color: '#d4c5a9',
            fontSize: '13px',
            marginBottom: '12px',
            flex: 1
          }}
        >
          {game.description || '暂无描述'}
        </Paragraph>

        <div style={{ 
          display: 'flex', 
          gap: '8px',
          borderTop: '1px solid rgba(200, 140, 80, 0.2)',
          paddingTop: '12px'
        }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => handlePreview(game)}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, rgba(255,140,60,0.9), rgba(200,100,40,0.9))',
              border: 'none'
            }}
          >
            预览
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(game)}
            disabled={!game.game_file_url}
            style={{
              flex: 1,
              background: 'rgba(80,50,30,0.8)',
              borderColor: 'rgba(200,140,80,0.5)',
              color: '#FFD76E'
            }}
          >
            下载
          </Button>
        </div>
      </div>
    </Card>
  )

  const renderGameGrid = (games: Game[] | undefined, loading: boolean, emptyText: string) => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      )
    }

    if (!games || games.length === 0) {
      return (
        <Empty 
          description={emptyText}
          style={{ padding: '60px 0' }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )
    }

    return (
      <Row gutter={[24, 24]}>
        {games.map(game => (
          <Col xs={24} sm={12} md={8} lg={6} xl={4} key={game.id}>
            {renderGameCard(game)}
          </Col>
        ))}
      </Row>
    )
  }

  return (
    <div style={{ 
      padding: '24px',
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1a0f08 0%, #2a1810 50%, #1a0f08 100%)'
    }}>
      {/* 浮动标语 */}
      <div style={{
        position: 'fixed',
        top: '100px',
        right: '60px',
        fontSize: '24px',
        fontWeight: 700,
        color: '#FFD76E',
        textShadow: '0 0 15px rgba(255,193,7,0.8), 0 0 30px rgba(255,215,0,0.6)',
        animation: 'dashboardFloat1 4s ease-in-out infinite',
        zIndex: 10,
        pointerEvents: 'none',
        letterSpacing: '0.08em'
      }}>
        在游戏中感受创造的神奇
      </div>

      <div style={{
        position: 'fixed',
        top: '145px',
        right: '60px',
        fontSize: '24px',
        fontWeight: 700,
        color: '#FFD76E',
        textShadow: '0 0 15px rgba(255,193,7,0.8), 0 0 30px rgba(255,215,0,0.6)',
        animation: 'dashboardFloat2 4s ease-in-out infinite',
        animationDelay: '2s',
        zIndex: 10,
        pointerEvents: 'none',
        letterSpacing: '0.08em'
      }}>
        在创造后体验游戏的乐趣
      </div>

      <Title level={2} style={{ color: '#FFD76E', marginBottom: '24px' }}>
        🎮 游戏中心
      </Title>

      <Tabs 
        activeKey={activeTab}
        onChange={setActiveTab}
        size="large"
      >
        <TabPane 
          tab={
            <span>
              <TrophyOutlined /> Top 10 热门游戏
            </span>
          } 
          key="top"
        >
          <Card style={{
            background: 'rgba(40, 25, 15, 0.6)',
            border: '1px solid rgba(200, 140, 80, 0.3)',
            marginBottom: '24px'
          }}>
            <Text style={{ color: '#d4c5a9' }}>
              <FireOutlined style={{ color: '#ff6b6b' }} /> 根据人气和评分排名的顶级游戏
            </Text>
          </Card>
          {renderGameGrid(topGames, topLoading, '暂无热门游戏')}
        </TabPane>

        <TabPane 
          tab={
            <span>
              <ClockCircleOutlined /> 最新游戏
            </span>
          } 
          key="latest"
        >
          <Card style={{
            background: 'rgba(40, 25, 15, 0.6)',
            border: '1px solid rgba(200, 140, 80, 0.3)',
            marginBottom: '24px'
          }}>
            <Text style={{ color: '#d4c5a9' }}>
              <ClockCircleOutlined style={{ color: '#52c41a' }} /> 最新发布的游戏作品
            </Text>
          </Card>
          {renderGameGrid(latestGames, latestLoading, '暂无最新游戏')}
        </TabPane>

        <TabPane 
          tab={
            <span>
              <TeamOutlined /> 我的公司游戏
            </span>
          } 
          key="my"
        >
          <Card style={{
            background: 'rgba(40, 25, 15, 0.6)',
            border: '1px solid rgba(200, 140, 80, 0.3)',
            marginBottom: '24px'
          }}>
            <Text style={{ color: '#d4c5a9' }}>
              <TeamOutlined style={{ color: '#1890ff' }} /> 您的公司创建的所有游戏
            </Text>
          </Card>
          {renderGameGrid(myGames, myLoading, '您的公司还没有创建任何游戏')}
        </TabPane>
      </Tabs>

      {/* 游戏预览Modal */}
      <Modal
        title={
          <span style={{ color: '#FFD76E', fontSize: '20px' }}>
            🎮 {selectedGame?.name}
          </span>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={1000}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} onClick={() => selectedGame && handleDownload(selectedGame)}>
            下载游戏
          </Button>,
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            关闭
          </Button>
        ]}
        style={{
          top: 20
        }}
      >
        {selectedGame && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card style={{ background: 'rgba(40, 25, 15, 0.6)' }}>
                  <Title level={4} style={{ color: '#FFD76E' }}>游戏信息</Title>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Text style={{ color: '#c8a060' }}>类型：</Text>
                      <Text style={{ color: '#d4c5a9' }}>{selectedGame.genre}</Text>
                    </Col>
                    <Col span={12}>
                      <Text style={{ color: '#c8a060' }}>版本：</Text>
                      <Text style={{ color: '#d4c5a9' }}>v{selectedGame.version}</Text>
                    </Col>
                    <Col span={12}>
                      <Text style={{ color: '#c8a060' }}>质量评分：</Text>
                      <Text style={{ color: '#d4c5a9' }}>{selectedGame.quality_score}/100</Text>
                    </Col>
                    <Col span={12}>
                      <Text style={{ color: '#c8a060' }}>人气评分：</Text>
                      <Text style={{ color: '#d4c5a9' }}>{selectedGame.popularity_score}/100</Text>
                    </Col>
                    <Col span={24}>
                      <Text style={{ color: '#c8a060' }}>描述：</Text>
                      <Paragraph style={{ color: '#d4c5a9', marginTop: '8px' }}>
                        {selectedGame.description || '暂无描述'}
                      </Paragraph>
                    </Col>
                  </Row>
                </Card>
              </Col>

              <Col span={24}>
                <Card 
                  title={<span style={{ color: '#FFD76E' }}>游戏预览</span>}
                  style={{ background: 'rgba(40, 25, 15, 0.6)' }}
                >
                  {selectedGame.game_file_url && selectedGame.game_file_type === 'web' ? (
                    <iframe
                      src={selectedGame.game_file_url}
                      style={{
                        width: '100%',
                        height: '500px',
                        border: '1px solid rgba(200, 140, 80, 0.3)',
                        borderRadius: '8px'
                      }}
                      title="Game Preview"
                    />
                  ) : (
                    <div style={{
                      height: '500px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(20, 15, 10, 0.8)',
                      borderRadius: '8px',
                      border: '1px solid rgba(200, 140, 80, 0.3)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <PlayCircleOutlined style={{ fontSize: '64px', color: '#FFD76E', marginBottom: '16px' }} />
                        <Title level={4} style={{ color: '#c8a060' }}>
                          {selectedGame.game_file_type === 'exe' || selectedGame.game_file_type === 'zip' 
                            ? '此游戏需要下载后运行' 
                            : '游戏预览暂不可用'}
                        </Title>
                        <Text style={{ color: '#d4c5a9' }}>
                          请点击下载按钮获取游戏文件
                        </Text>
                      </div>
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Games
