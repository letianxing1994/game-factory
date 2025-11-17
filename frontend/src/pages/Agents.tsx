import React, { useMemo, useState } from 'react'
import { useQuery } from 'react-query'
import {
  Alert,
  Button,
  Card,
  Form,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { apiClient } from '../services/api'
import type { AgentPreviewResult, EmployeeAgent, GameGenreSelection } from '../types'

const { Title, Text } = Typography

const agentStageMap: Record<string, string> = {
  planner: 'planning',
  artist: 'art',
  developer: 'tech',
  tester: 'test',
  operator: 'planning',
}

const genreOptions = [
  { label: 'RPG', value: 'rpg' },
  { label: 'SLG', value: 'slg' },
  { label: 'Shooter', value: 'shooter' },
  { label: 'MOBA', value: 'moba' },
  { label: 'ACT', value: 'act' },
  { label: 'AVG', value: 'avg' },
  { label: 'SIM', value: 'sim' },
  { label: 'FTG', value: 'ftg' },
  { label: 'RAC', value: 'rac' },
  { label: 'Sandbox', value: 'sandbox' },
  { label: 'Survival', value: 'survival' },
  { label: 'Card', value: 'card' },
  { label: 'Casual', value: 'casual' },
  { label: 'Puzzle', value: 'puzzle' },
  { label: 'Rhythm', value: 'rhythm' },
  { label: 'Horror', value: 'horror' },
]

const subGenreOptions: Record<string, { label: string; value: string }[]> = {
  rpg: [
    { label: 'ARPG', value: 'arpg' },
    { label: '回合制RPG', value: 'turn_based_rpg' },
    { label: 'MMORPG', value: 'mmorpg' },
  ],
  slg: [
    { label: '回合制SLG', value: 'turn_based_slg' },
    { label: 'RTS', value: 'rts' },
    { label: 'SRPG', value: 'srpg' },
  ],
  shooter: [
    { label: 'FPS', value: 'fps' },
    { label: 'TPS', value: 'tps' },
  ],
  act: [
    { label: '动作冒险', value: 'action_adventure' },
    { label: 'Roguelike', value: 'rougelike' },
  ],
  avg: [
    { label: '视觉小说', value: 'visual_novel' },
  ],
  sim: [
    { label: '生活模拟', value: 'life_sim' },
    { label: '经营管理', value: 'management' },
  ],
  rac: [
    { label: '驾驶', value: 'driving' },
  ],
  sandbox: [
    { label: '建造/创造', value: 'crafting' },
  ],
  survival: [
    { label: '心理恐怖', value: 'psychological_horror' },
  ],
  card: [
    { label: '卡组构筑', value: 'deck_builder' },
  ],
  casual: [
    { label: 'Match-3', value: 'match3' },
  ],
  puzzle: [
    { label: '平台解谜', value: 'platform_puzzle' },
  ],
  rhythm: [
    { label: '节奏动作', value: 'rhythm_action' },
  ],
  horror: [
    { label: '心理恐怖', value: 'psychological_horror' },
  ],
}

const defaultGdd = (values: PreviewFormValues) => {
  const now = new Date().toISOString()
  return {
    projectId: `preview-${Date.now()}`,
    projectName: values.projectName,
    coreConcept: values.projectDescription || 'Preview concept',
    gameType: values.primaryGenre,
    primaryGenre: values.primaryGenre,
    subGenre: values.subGenre,
    hybridGenres: values.hybridGenres,
    dimension: values.dimension,
    artStyle: values.artStyle,
    gameMode: values.gameMode,
    gameplayMechanics: [
      {
        name: '核心玩法',
        description: values.projectDescription || '快速验证体验',
        implementationDetails: 'Auto-generated preview mechanic',
      },
    ],
    artRequirements: [
      { type: 'character', description: '示例角色', quantity: 1, priority: 'high' },
      { type: 'environment', description: '示例场景', quantity: 1, priority: 'medium' },
    ],
    audioRequirements: [
      { type: 'bgm', description: '示例BGM', quantity: 1, priority: 'high' },
    ],
    technicalRequirements: {
      engine: values.engine || 'Unity',
      targetPlatforms: ['PC'],
      performanceRequirements: 'Preview profile',
    },
    createdAt: now,
    updatedAt: now,
  }
}

interface PreviewFormValues {
  projectName: string
  primaryGenre: string
  subGenre?: string
  hybridGenres?: string[]
  dimension: '2d' | '3d'
  artStyle: string
  gameMode: 'singleplayer' | 'multiplayer'
  projectDescription?: string
  stageMode?: string
  cloudProvider?: 'aliyun' | 'gcp'
  gddDescription?: string
  artAssets?: string
  musicAssets?: string
  buildUrl?: string
  engine?: string
}

const imageFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif']
const audioFormats = ['mp3', 'wav', 'ogg']
const videoFormats = ['mp4', 'webm']

const buildGenreSelection = (values: PreviewFormValues): GameGenreSelection => {
  const hybrid =
    values.hybridGenres?.filter((genre) => genre && genre !== values.primaryGenre) || []
  return {
    primary: values.primaryGenre as GameGenreSelection['primary'],
    subGenre: values.subGenre as GameGenreSelection['subGenre'],
    hybrid: hybrid.length ? (hybrid as GameGenreSelection['hybrid']) : undefined,
  }
}

const ArtifactPreview: React.FC<{ artifact: NonNullable<AgentPreviewResult['artifacts']>[number] }> = ({
  artifact,
}) => {
  const format = artifact.format?.toLowerCase() || ''
  if (imageFormats.some((ext) => format.includes(ext))) {
    return <Image src={artifact.url} alt={artifact.type} style={{ maxHeight: 200 }} />
  }
  if (audioFormats.some((ext) => format.includes(ext))) {
    return <audio controls src={artifact.url} style={{ width: '100%' }} />
  }
  if (videoFormats.some((ext) => format.includes(ext))) {
    return <video controls src={artifact.url} style={{ width: '100%' }} />
  }
  return null
}

const Agents: React.FC = () => {
  const [previewForm] = Form.useForm<PreviewFormValues>()
  const [previewAgent, setPreviewAgent] = useState<EmployeeAgent | null>(null)
  const [previewResult, setPreviewResult] = useState<AgentPreviewResult | null>(null)
  const [loading, setLoading] = useState(false)

  const { data: agentsRes, refetch } = useQuery(['agents', 'mine'], async () => {
    const res = await apiClient.get<{ success: boolean; data: EmployeeAgent[] }>('/agents/my')
    return res.data
  })

  const agentList = useMemo(() => agentsRes?.data || [], [agentsRes])

  const currentPrimaryGenre = Form.useWatch('primaryGenre', previewForm)
  const previewSubOptions = useMemo(
    () => subGenreOptions[currentPrimaryGenre as string] || [],
    [currentPrimaryGenre]
  )
  const previewHybridOptions = useMemo(
    () => genreOptions.filter((option) => option.value !== currentPrimaryGenre),
    [currentPrimaryGenre]
  )

  const handlePreview = async (values: PreviewFormValues) => {
    if (!previewAgent) return
    const stageId = agentStageMap[previewAgent.type] || values.stageMode || 'planning'
    const payload: any = {
      project: {
        projectName: values.projectName,
        description: values.projectDescription,
      },
      cloudProvider: values.cloudProvider || 'aliyun',
      stage: {
        stageId,
        mode: values.stageMode || 'llm+kb',
      },
    }

    if (stageId === 'planning') {
      const genre = buildGenreSelection(values)
      payload.userInput = {
        projectName: values.projectName,
        gameGenre: genre,
        gameType: genre.primary,
        dimension: values.dimension,
        artStyle: values.artStyle,
        gameMode: values.gameMode,
        additionalRequirements: values.projectDescription,
      }
    } else {
      payload.gdd = defaultGdd(values)
    }

    if (stageId === 'tech') {
      payload.assets = {
        art: (values.artAssets || '').split(',').map((item) => item.trim()).filter(Boolean),
        music: (values.musicAssets || '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }
    }

    if (stageId === 'test') {
      payload.assets = {
        code: values.buildUrl,
      }
    }

    setLoading(true)
    try {
      const res = await apiClient.post<{
        success: boolean
        data: AgentPreviewResult
      }>(`/workflows/agents/${previewAgent.id}/preview`, payload)
      if (!res.success) {
        message.error('试运行失败')
        return
      }
      setPreviewResult(res.data)
      message.success('试运行完成')
    } catch (error: any) {
      message.error(error?.response?.data?.message || '试运行失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '姓名', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      render: (value: EmployeeAgent['type']) => <Tag color="blue">{value}</Tag>,
    },
    { title: '专长', dataIndex: 'specialization' },
    {
      title: '技能',
      dataIndex: 'skills',
      render: (skills: string[]) =>
        skills?.length ? (
          <Space wrap>
            {skills.slice(0, 3).map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
          </Space>
        ) : (
          '--'
        ),
    },
    {
      title: '薪资',
      dataIndex: 'salaryRequirement',
      render: (value: number) => `${value} G币`,
    },
    {
      title: '操作',
      render: (_: any, record: EmployeeAgent) => (
        <Space>
          <Button type="link" onClick={() => setPreviewAgent(record)}>
            试运行
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title level={3} className="!mb-0">
          员工Agent管理
        </Title>
        <Button onClick={() => refetch()}>刷新</Button>
      </div>

      <Card>
        {agentList.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message="您还没有员工Agent，创建后即可在这里试运行效果。"
          />
        ) : (
          <Table rowKey="id" columns={columns} dataSource={agentList} pagination={false} />
        )}
      </Card>

      <Modal
        open={!!previewAgent}
        title={previewAgent ? `试运行：${previewAgent.name}` : ''}
        onCancel={() => {
          setPreviewAgent(null)
          setPreviewResult(null)
        }}
        width={720}
        footer={null}
        destroyOnClose
      >
        {previewAgent && (
          <div className="space-y-4">
            <Alert
              type="info"
              message={`该员工将按 ${agentStageMap[previewAgent.type] || 'planning'} 阶段执行`}
              showIcon
            />
            <Form
              form={previewForm}
              layout="vertical"
              onFinish={handlePreview}
              initialValues={{
                primaryGenre: 'rpg',
                hybridGenres: [],
                cloudProvider: 'aliyun',
                dimension: '3d',
                artStyle: 'realistic',
                gameMode: 'singleplayer',
              }}
            >
              <Form.Item
                name="projectName"
                label="项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="projectDescription" label="项目概述">
                <Input.TextArea rows={3} />
              </Form.Item>
              <Form.Item label="基础配置" required>
                <Space wrap>
                  <Form.Item name="primaryGenre" noStyle rules={[{ required: true }]}>
                    <Select placeholder="主类型" style={{ width: 140 }} options={genreOptions} />
                  </Form.Item>
                  <Form.Item name="subGenre" noStyle>
                    <Select
                      allowClear
                      placeholder="子类型"
                      style={{ width: 150 }}
                      options={previewSubOptions}
                    />
                  </Form.Item>
                  <Form.Item name="hybridGenres" noStyle>
                    <Select
                      mode="multiple"
                      allowClear
                      placeholder="混合类型"
                      style={{ width: 200 }}
                      options={previewHybridOptions}
                    />
                  </Form.Item>
                  <Form.Item name="dimension" noStyle initialValue="3d" rules={[{ required: true }]}>
                    <Select placeholder="维度" style={{ width: 120 }}>
                      <Select.Option value="2d">2D</Select.Option>
                      <Select.Option value="3d">3D</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="artStyle"
                    noStyle
                    initialValue="realistic"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="画风" style={{ width: 120 }}>
                      {['realistic', 'cartoon', 'pixel'].map((style) => (
                        <Select.Option key={style} value={style}>
                          {style}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="gameMode"
                    noStyle
                    initialValue="singleplayer"
                    rules={[{ required: true }]}
                  >
                    <Select placeholder="模式" style={{ width: 140 }}>
                      <Select.Option value="singleplayer">单机</Select.Option>
                      <Select.Option value="multiplayer">联机</Select.Option>
                    </Select>
                  </Form.Item>
                </Space>
              </Form.Item>
              {agentStageMap[previewAgent.type] === 'tech' && (
                <>
                  <Form.Item name="artAssets" label="美术资源URL(逗号分隔)">
                    <Input placeholder="https://oss.example.com/art.png, https://..." />
                  </Form.Item>
                  <Form.Item name="musicAssets" label="音乐资源URL(逗号分隔)">
                    <Input placeholder="https://oss.example.com/bgm.mp3" />
                  </Form.Item>
                </>
              )}
              {agentStageMap[previewAgent.type] === 'test' && (
                <Form.Item
                  name="buildUrl"
                  label="构建下载地址"
                  rules={[{ required: true, message: '请输入构建URL' }]}
                >
                  <Input placeholder="https://oss.example.com/build.zip" />
                </Form.Item>
              )}
              <Form.Item name="cloudProvider" label="云服务商" initialValue="aliyun">
                <Select style={{ width: 200 }}>
                  <Select.Option value="aliyun">阿里云 OSS</Select.Option>
                  <Select.Option value="gcp">Google Cloud</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button htmlType="submit" type="primary" loading={loading}>
                    开始试运行
                  </Button>
                  <Button onClick={() => refetch()}>刷新员工信息</Button>
                </Space>
              </Form.Item>
            </Form>

            {previewResult && (
              <Card size="small" title="试运行结果">
                <p>
                  阶段 <Tag color="blue">{previewResult.stageId}</Tag> 状态{' '}
                  <Tag color="green">{previewResult.status || 'completed'}</Tag>
                </p>
                {previewResult.artifacts && previewResult.artifacts.length > 0 ? (
                  <Space direction="vertical" className="w-full">
                    {previewResult.artifacts.map((artifact) => (
                      <Card size="small" key={artifact.artifactId || artifact.url}>
                        <Space direction="vertical" className="w-full">
                          <Text strong>{artifact.type}</Text>
                          <Text type="secondary">{artifact.format}</Text>
                          <a href={artifact.url} target="_blank" rel="noreferrer">
                            下载 / 查看
                          </a>
                          <ArtifactPreview artifact={artifact} />
                        </Space>
                      </Card>
                    ))}
                  </Space>
                ) : (
                  <Alert message="暂无可用的产出，请检查输入后再次尝试" type="warning" showIcon />
                )}
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Agents