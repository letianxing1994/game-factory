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

// AI模型选项
const aiModelOptions = {
  planner: [
    { label: 'DeepSeek R1（默认）', value: 'deepseek-r1' },
    { label: 'GPT-5', value: 'gpt-5' },
    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
  ],
  artist: [
    { label: 'DALL-E-3（默认）', value: 'dall-e-3' },
    { label: 'Midjourney', value: 'midjourney' },
    { label: 'Stable Diffusion', value: 'stable-diffusion' },
  ],
  developer: [
    { label: 'GPT-5（默认）', value: 'gpt-5' },
    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
    { label: 'Deepseek Coder', value: 'deepseek-coder' },
  ],
  tester: [
    { label: 'Claude Sonnet 4.5（默认）', value: 'claude-sonnet-4.5' },
    { label: 'GPT-4o', value: 'gpt-4o' },
  ],
  music: [
    { label: 'GPT-4o（默认）', value: 'gpt-4o' },
    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
  ],
}

// 专业方向选项（根据type不同）
const specializationOptions = {
  planner: [
    { label: 'RPG', value: 'rpg' },
    { label: 'MOBA', value: 'moba' },
    { label: 'SLG', value: 'slg' },
    { label: 'Shooter', value: 'shooter' },
    { label: 'Casual', value: 'casual' },
    { label: 'Sandbox', value: 'sandbox' },
  ],
  artist: [
    { label: '写实风格', value: 'realistic' },
    { label: '卡通风格', value: 'cartoon' },
    { label: '像素风格', value: 'pixel' },
    { label: '动漫风格', value: 'anime' },
  ],
  developer: [
    { label: '单机游戏', value: 'singleplayer' },
    { label: '网络游戏', value: 'multiplayer' },
  ],
  tester: [
    { label: '功能测试', value: 'functional' },
    { label: '性能测试', value: 'performance' },
    { label: '安全测试', value: 'security' },
  ],
  music: [
    { label: '管弦乐', value: 'orchestral' },
    { label: '电子音乐', value: 'electronic' },
    { label: '环境音', value: 'ambient' },
  ],
}

const Agents: React.FC = () => {
  const [previewForm] = Form.useForm<PreviewFormValues>()
  const [createForm] = Form.useForm()
  const [previewAgent, setPreviewAgent] = useState<EmployeeAgent | null>(null)
  const [previewResult, setPreviewResult] = useState<AgentPreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('')

  const { data: agentsRes, refetch } = useQuery(['agents', 'mine'], async () => {
    const res = await apiClient.get<{ success: boolean; data: EmployeeAgent[] }>('/agents/my')
    return res.data
  })

  const { data: companiesRes } = useQuery(['companies', 'my'], async () => {
    const res = await apiClient.get<{ success: boolean; data: any[] }>('/companies/my')
    return res.data
  })

  const agentList = useMemo(() => agentsRes?.data || [], [agentsRes])
  const myCompanies = useMemo(() => companiesRes?.data || [], [companiesRes])

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

  const handleCreateAgent = async (values: any) => {
    setLoading(true)
    try {
      const payload = {
        name: values.name,
        type: values.type,
        dimension: values.dimension || undefined,
        ai_model: values.ai_model || undefined,
        specialization: values.specialization,
        extra_traits: values.extra_traits || undefined,
        companyId: values.companyId || undefined,
      }
      const res = await apiClient.post<{ success: boolean; data: EmployeeAgent }>(
        '/agents',
        payload
      )
      if (res.success) {
        message.success(`员工 ${values.name} 创建成功！`)
        setCreateModalOpen(false)
        createForm.resetFields()
        refetch()
      } else {
        message.error('创建失败')
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '创建员工失败')
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    { title: '姓名', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      render: (value: EmployeeAgent['type'], record: EmployeeAgent) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{value}</Tag>
          {record.type === 'artist' && record.dimension && (
            <Tag color="purple" style={{ fontSize: '11px' }}>
              {record.dimension === '2d' ? '2D美术' : '3D美术'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'AI模型',
      dataIndex: 'ai_model',
      render: (model: string, record: EmployeeAgent) => {
        // 3D美术Agent显示双模型
        if (record.type === 'artist' && record.dimension === '3d') {
          return (
            <Space direction="vertical" size={2}>
              <Tag color="green">DALL-E-3 (贴图)</Tag>
              <Tag color="cyan">Meshy-4 (模型)</Tag>
            </Space>
          )
        }
        // 2D美术Agent
        if (record.type === 'artist' && record.dimension === '2d') {
          return <Tag color="green">DALL-E-3</Tag>
        }
        // 其他Agent显示单一模型
        return <Tag>{model || '默认模型'}</Tag>
      },
    },
    { title: '专业', dataIndex: 'specialization' },
    {
      title: '额外特点',
      dataIndex: 'extra_traits',
      ellipsis: true,
      render: (value: string) => value || '--',
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
        <Space>
          <Button type="primary" onClick={() => setCreateModalOpen(true)}>
            创建员工
          </Button>
          <Button onClick={() => refetch()}>刷新</Button>
        </Space>
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

      <Modal
        title="创建员工Agent"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          createForm.resetFields()
        }}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form 
          form={createForm} 
          layout="vertical" 
          onFinish={handleCreateAgent}
          onValuesChange={(changedValues) => {
            if (changedValues.type) {
              setSelectedType(changedValues.type)
              // 切换类型时清空专业字段
              createForm.setFieldsValue({ specialization: undefined, ai_model: undefined, dimension: undefined })
            }
          }}
        >
          <Form.Item
            name="name"
            label="员工名称"
            rules={[{ required: true, message: '请输入员工名称' }]}
          >
            <Input placeholder="例如：张三" />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择员工类型' }]}
          >
            <Select placeholder="选择员工类型">
              <Select.Option value="planner">策划</Select.Option>
              <Select.Option value="artist">美术</Select.Option>
              <Select.Option value="developer">技术</Select.Option>
              <Select.Option value="tester">测试</Select.Option>
              <Select.Option value="music">音乐</Select.Option>
            </Select>
          </Form.Item>

          {selectedType === 'artist' && (
            <Form.Item
              name="dimension"
              label="维度"
              rules={[{ required: true, message: '请选择维度' }]}
              tooltip="2D美术使用单个图像生成模型，3D美术使用贴图+3D模型双模型"
            >
              <Select placeholder="选择维度">
                <Select.Option value="2d">2D</Select.Option>
                <Select.Option value="3d">3D</Select.Option>
              </Select>
            </Form.Item>
          )}

          {selectedType && (
            <Form.Item
              name="specialization"
              label="专业方向"
              rules={[{ required: true, message: '请选择专业方向' }]}
              tooltip={
                selectedType === 'planner'
                  ? '擅长的游戏品类'
                  : selectedType === 'artist'
                  ? '擅长的美术风格'
                  : selectedType === 'developer'
                  ? '擅长的技术方向'
                  : '专业方向'
              }
            >
              <Select 
                placeholder="选择专业方向" 
                options={specializationOptions[selectedType as keyof typeof specializationOptions] || []}
              />
            </Form.Item>
          )}

          {selectedType && (
            <Form.Item
              name="ai_model"
              label="AI模型"
              tooltip="留空则使用配置文件中的默认模型"
            >
              <Select 
                placeholder="选择AI模型（可选）" 
                allowClear
                options={aiModelOptions[selectedType as keyof typeof aiModelOptions] || []}
              />
            </Form.Item>
          )}

          <Form.Item 
            name="extra_traits" 
            label="额外特点"
            tooltip="会注入到agent执行时的系统提示词中，影响输出结果"
          >
            <Input.TextArea 
              rows={3} 
              placeholder="例如：擅长C++性能优化和内存管理、精通日式动漫风格和角色设计、擅长数值平衡和经济系统设计等" 
            />
          </Form.Item>

          <Form.Item name="companyId" label="分配到公司">
            <Select placeholder="不选择则员工暂不分配" allowClear>
              {myCompanies.map((company: any) => (
                <Select.Option key={company.id} value={company.id}>
                  {company.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Alert
            type="info"
            message="提示"
            description="员工可以立即分配到公司开始工作。AI模型和额外特点会影响agent的实际执行效果。"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建员工
              </Button>
              <Button
                onClick={() => {
                  setCreateModalOpen(false)
                  createForm.resetFields()
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Agents