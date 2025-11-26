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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { apiClient } from '../services/api'
import type { AgentPreviewResult, EmployeeAgent } from '../types'

const { Title, Text } = Typography

const agentStageMap: Record<string, string> = {
  planner: 'planning',
  architect: 'architecture',
  artist: 'art',
  developer: 'tech',
  tester: 'test',
  operator: 'planning',
  music: 'music',
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
  architect: [
    { label: 'Claude Sonnet 4.5（默认）', value: 'claude-sonnet-4.5' },
    { label: 'GPT-5', value: 'gpt-5' },
    { label: 'DeepSeek R1', value: 'deepseek-r1' },
  ],
  artist2d: [
    { label: 'DALL-E-3（默认）', value: 'dall-e-3' },
    { label: 'Banana2（Google）', value: 'banana2' },
    { label: 'Midjourney', value: 'midjourney' },
    { label: 'Stable Diffusion', value: 'stable-diffusion' },
  ],
  artist3d_2d: [
    { label: 'DALL-E-3（推荐）', value: 'dall-e-3' },
    { label: 'Banana2（Google）', value: 'banana2' },
    { label: 'Midjourney', value: 'midjourney' },
    { label: 'Stable Diffusion', value: 'stable-diffusion' },
  ],
  artist3d_3d: [
    { label: 'Meshy-4（推荐）', value: 'meshy-4' },
    { label: 'Luma AI', value: 'luma-ai' },
    { label: 'Rodin', value: 'rodin' },
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
  architect: [
    { label: 'Unity引擎', value: 'unity' },
    { label: 'Unreal Engine', value: 'unreal' },
    { label: 'Godot引擎', value: 'godot' },
    { label: 'OpenGL原生', value: 'opengl' },
    { label: 'Vulkan原生', value: 'vulkan' },
    { label: 'DirectX12原生', value: 'directx12' },
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
  const [createForm] = Form.useForm()
  const [previewAgent, setPreviewAgent] = useState<EmployeeAgent | null>(null)
  const [previewResult, setPreviewResult] = useState<AgentPreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedDimension, setSelectedDimension] = useState<string>('')
  const [previewConfirmVisible, setPreviewConfirmVisible] = useState(false)
  const [pendingPreviewAgent, setPendingPreviewAgent] = useState<EmployeeAgent | null>(null)
  const [createMode, setCreateMode] = useState<'form' | 'chat'>('form')
  const [conversationalMessages, setConversationalMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [conversationalInput, setConversationalInput] = useState('')
  const [conversationalLoading, setConversationalLoading] = useState(false)
  const [conversationalModel, setConversationalModel] = useState('gpt-4o')
  const [selectedCompanyForConv, setSelectedCompanyForConv] = useState<number>()
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [agentToAssign, setAgentToAssign] = useState<EmployeeAgent | null>(null)
  const [selectedCompanyForAssign, setSelectedCompanyForAssign] = useState<number | undefined>(undefined)

  const { data: agentsRes, refetch } = useQuery(
    ['agents', 'mine'],
    async () => {
      const res = await apiClient.get<{ success: boolean; data: EmployeeAgent[] }>('/agents/my')
      console.log('Agents API response:', res)
      return res
    },
    {
      refetchOnMount: 'always',
      cacheTime: 0,
      staleTime: 0,
    }
  )

  const { data: companiesRes } = useQuery(['companies', 'my'], async () => {
    const res = await apiClient.get<{ success: boolean; data: any[] }>('/companies/my')
    return res
  })

  const agentList = useMemo(() => {
    console.log('agentsRes:', agentsRes)
    console.log('agentList:', agentsRes?.data || [])
    return agentsRes?.data || []
  }, [agentsRes])
  const myCompanies = useMemo(() => companiesRes?.data || [], [companiesRes])

  // 简化版本：使用agent默认配置直接运行
  const handlePreviewWithDefaults = async (agent: EmployeeAgent) => {
    const stageId = agentStageMap[agent.type] || 'planning'
    const projectName = `${agent.name}的试运行项目`
    
    const defaultValues: PreviewFormValues = {
      projectName,
      projectDescription: `测试${agent.name}的工作能力`,
      primaryGenre: 'rpg',
      dimension: (agent.dimension || '3d') as '2d' | '3d',
      artStyle: agent.specialization || 'realistic',
      gameMode: 'singleplayer' as 'singleplayer' | 'multiplayer',
      cloudProvider: 'aliyun',
    }

    const payload: any = {
      project: {
        projectName: defaultValues.projectName,
        description: defaultValues.projectDescription,
      },
      cloudProvider: 'aliyun',
      stage: {
        stageId,
        mode: 'llm+kb',
      },
    }

    if (stageId === 'planning') {
      payload.userInput = {
        projectName: defaultValues.projectName,
        gameGenre: {
          primary: defaultValues.primaryGenre,
        },
        gameType: defaultValues.primaryGenre,
        dimension: defaultValues.dimension,
        artStyle: defaultValues.artStyle,
        gameMode: defaultValues.gameMode,
        additionalRequirements: defaultValues.projectDescription,
      }
    } else {
      payload.gdd = defaultGdd(defaultValues)
    }

    setLoading(true)
    try {
      const res = await apiClient.post<{
        success: boolean
        data: AgentPreviewResult
      }>(`/workflows/agents/${agent.id}/preview`, payload)
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
      const payload: any = {
        name: values.name,
        type: values.type,
        dimension: values.dimension || undefined,
        specialization: values.specialization,
        extra_traits: values.extra_traits || undefined,
        companyId: values.companyId || undefined,
      }
      
      // 3D美术Agent使用双模型
      if (values.type === 'artist' && values.dimension === '3d') {
        payload.ai_model_2d = values.ai_model_2d || 'dall-e-3'
        payload.ai_model_3d = values.ai_model_3d || 'meshy-4'
      } else if (values.type === 'artist' && values.dimension === '2d') {
        // 2D美术Agent只用2D模型
        payload.ai_model_2d = values.ai_model_2d || 'dall-e-3'
      } else {
        // 其他Agent使用单一ai_model
        payload.ai_model = values.ai_model || undefined
      }
      
      const res = await apiClient.post<{ success: boolean; data: EmployeeAgent }>(
        '/agents',
        payload
      )
      if (res.success) {
        message.success(`员工 ${values.name} 创建成功！`)
        setCreateModalOpen(false)
        createForm.resetFields()
        setSelectedType('')
        setSelectedDimension('')
        // 延迟100ms后刷新，确保数据库写入完成
        setTimeout(() => {
          refetch()
        }, 100)
      } else {
        message.error('创建失败')
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '创建员工失败')
    } finally {
      setLoading(false)
    }
  }

  const handleConversationalAgentSend = async () => {
    if (!conversationalInput.trim()) {
      message.warning('请输入内容')
      return
    }

    if (!selectedCompanyForConv) {
      message.warning('请先选择要分配的公司')
      return
    }

    const userMessage = conversationalInput.trim()
    const newMessages = [...conversationalMessages, { role: 'user' as const, content: userMessage }]
    setConversationalMessages(newMessages)
    setConversationalInput('')
    setConversationalLoading(true)

    let assistantMessage = ''
    setConversationalMessages([...newMessages, { role: 'assistant' as const, content: '' }])

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
      const token = localStorage.getItem('token')
      
      const response = await fetch(`${API_BASE_URL}/agents/conversational`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          model: conversationalModel,
          conversationHistory: conversationalMessages,
          companyId: selectedCompanyForConv
        })
      })

      if (!response.ok) {
        throw new Error('请求失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              break
            }

            try {
              const parsed = JSON.parse(data)
              
              if (parsed.type === 'token') {
                assistantMessage += parsed.content
                setConversationalMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
              } else if (parsed.type === 'success') {
                assistantMessage = parsed.content
                setConversationalMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
                
                if (parsed.agentId) {
                  message.success('员工创建成功！')
                  setTimeout(() => {
                    setCreateModalOpen(false)
                    setCreateMode('form')
                    setConversationalMessages([])
                    setSelectedCompanyForConv(undefined)
                    refetch()
                  }, 1500)
                }
              } else if (parsed.type === 'error') {
                message.error(parsed.content)
                assistantMessage = parsed.content
                setConversationalMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
              } else if (parsed.type === 'message') {
                assistantMessage = parsed.content
                setConversationalMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
              }
            } catch (e) {
              // 忽略JSON解析错误
            }
          }
        }
      }
    } catch (error: any) {
      console.error('对话失败:', error)
      message.error('对话失败，请重试')
      const errorMsg = '抱歉，发生了错误，请稍后重试。'
      setConversationalMessages([...newMessages, { role: 'assistant', content: errorMsg }])
    } finally {
      setConversationalLoading(false)
    }
  }

  const columns = [
    { title: '姓名', dataIndex: 'name' },
    {
      title: '类型',
      dataIndex: 'type',
      render: (value: EmployeeAgent['type'], record: EmployeeAgent) => {
        // 类型颜色映射 - 使用更柔和的暗色调
        const typeColorMap: Record<EmployeeAgent['type'], string> = {
          planner: 'rgba(64, 169, 255, 0.3)',
          architect: 'rgba(19, 194, 194, 0.3)',
          artist: 'rgba(235, 47, 150, 0.3)',
          developer: 'rgba(82, 196, 26, 0.3)',
          tester: 'rgba(250, 140, 22, 0.3)',
          operator: 'rgba(114, 46, 209, 0.3)',
          music: 'rgba(250, 173, 20, 0.3)',
        }
        const borderColorMap: Record<EmployeeAgent['type'], string> = {
          planner: 'rgba(64, 169, 255, 0.6)',
          architect: 'rgba(19, 194, 194, 0.6)',
          artist: 'rgba(235, 47, 150, 0.6)',
          developer: 'rgba(82, 196, 26, 0.6)',
          tester: 'rgba(250, 140, 22, 0.6)',
          operator: 'rgba(114, 46, 209, 0.6)',
          music: 'rgba(250, 173, 20, 0.6)',
        }
        const bgColor = typeColorMap[value] || 'rgba(217, 217, 217, 0.2)'
        const borderColor = borderColorMap[value] || 'rgba(217, 217, 217, 0.5)'
        return (
          <Space direction="vertical" size={0}>
            <span style={{ 
              display: 'inline-block',
              background: `linear-gradient(135deg, ${bgColor} 0%, rgba(40, 25, 15, 0.4) 100%)`,
              color: '#d4af37',
              border: `1px solid ${borderColor}`,
              fontWeight: 600,
              padding: '0 7px',
              fontSize: '12px',
              lineHeight: '20px',
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              boxShadow: 'inset 0 1px 0 rgba(255, 200, 120, 0.15), 0 2px 4px rgba(0, 0, 0, 0.4)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)'
            }}>{value}</span>
            {record.type === 'artist' && record.dimension && (
              <span style={{ 
                display: 'inline-block',
                fontSize: '11px',
                background: 'linear-gradient(135deg, rgba(255, 122, 69, 0.3) 0%, rgba(40, 25, 15, 0.4) 100%)',
                color: '#d4af37',
                border: '1px solid rgba(255, 122, 69, 0.6)',
                fontWeight: 600,
                padding: '0 7px',
                lineHeight: '18px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
                marginTop: '2px',
                boxShadow: 'inset 0 1px 0 rgba(255, 200, 120, 0.15), 0 2px 4px rgba(0, 0, 0, 0.4)',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(4px)'
              }}>
                {record.dimension === '2d' ? '2D美术' : '3D美术'}
              </span>
            )}
          </Space>
        )
      },
    },
    {
      title: 'AI模型',
      dataIndex: 'ai_model',
      render: (model: string, record: EmployeeAgent) => {
        // 获取模型颜色的辅助函数 - 使用更柔和的暗色调
        const getModelColor = (modelName: string): { bg: string; border: string } => {
          if (!modelName || modelName === '默认模型') {
            return { bg: 'rgba(217, 217, 217, 0.2)', border: 'rgba(217, 217, 217, 0.5)' }
          }
          const lowerModel = modelName.toLowerCase()
          if (lowerModel.includes('gpt-5')) return { bg: 'rgba(235, 47, 150, 0.3)', border: 'rgba(235, 47, 150, 0.6)' }
          if (lowerModel.includes('gpt-4o')) return { bg: 'rgba(114, 46, 209, 0.3)', border: 'rgba(114, 46, 209, 0.6)' }
          if (lowerModel.includes('gpt')) return { bg: 'rgba(47, 84, 235, 0.3)', border: 'rgba(47, 84, 235, 0.6)' }
          if (lowerModel.includes('claude')) return { bg: 'rgba(19, 194, 194, 0.3)', border: 'rgba(19, 194, 194, 0.6)' }
          if (lowerModel.includes('deepseek')) return { bg: 'rgba(24, 144, 255, 0.3)', border: 'rgba(24, 144, 255, 0.6)' }
          if (lowerModel.includes('dall-e')) return { bg: 'rgba(82, 196, 26, 0.3)', border: 'rgba(82, 196, 26, 0.6)' }
          if (lowerModel.includes('banana')) return { bg: 'rgba(250, 140, 22, 0.3)', border: 'rgba(250, 140, 22, 0.6)' }
          if (lowerModel.includes('midjourney')) return { bg: 'rgba(255, 77, 79, 0.3)', border: 'rgba(255, 77, 79, 0.6)' }
          if (lowerModel.includes('stable')) return { bg: 'rgba(160, 217, 17, 0.3)', border: 'rgba(160, 217, 17, 0.6)' }
          if (lowerModel.includes('meshy')) return { bg: 'rgba(250, 173, 20, 0.3)', border: 'rgba(250, 173, 20, 0.6)' }
          if (lowerModel.includes('luma')) return { bg: 'rgba(235, 47, 150, 0.3)', border: 'rgba(235, 47, 150, 0.6)' }
          if (lowerModel.includes('rodin')) return { bg: 'rgba(245, 34, 45, 0.3)', border: 'rgba(245, 34, 45, 0.6)' }
          return { bg: 'rgba(47, 84, 235, 0.3)', border: 'rgba(47, 84, 235, 0.6)' }
        }

        const createColoredTag = (text: string, colors: { bg: string; border: string }) => (
          <span style={{
            display: 'inline-block',
            background: `linear-gradient(135deg, ${colors.bg} 0%, rgba(40, 25, 15, 0.4) 100%)`,
            color: '#d4af37',
            border: `1px solid ${colors.border}`,
            fontWeight: 600,
            padding: '0 7px',
            fontSize: '12px',
            lineHeight: '20px',
            borderRadius: '3px',
            whiteSpace: 'nowrap',
            boxShadow: 'inset 0 1px 0 rgba(255, 200, 120, 0.15), 0 2px 4px rgba(0, 0, 0, 0.4)',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)'
          }}>{text}</span>
        )

        // 3D美术Agent显示双模型
        if (record.type === 'artist' && record.dimension === '3d') {
          const model2d = record.ai_model_2d || 'dall-e-3'
          const model3d = record.ai_model_3d || 'meshy-4'
          return (
            <Space direction="vertical" size={2}>
              {createColoredTag(`${model2d} (贴图)`, getModelColor(model2d))}
              {createColoredTag(`${model3d} (模型)`, getModelColor(model3d))}
            </Space>
          )
        }
        // 2D美术Agent
        if (record.type === 'artist' && record.dimension === '2d') {
          const model2d = record.ai_model_2d || 'dall-e-3'
          return createColoredTag(model2d, getModelColor(model2d))
        }
        // 其他Agent显示单一模型
        const displayModel = record.ai_model || model || '默认模型'
        return createColoredTag(displayModel, getModelColor(displayModel))
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
          <Button
            type="link"
            onClick={() => {
              setPendingPreviewAgent(record)
              setPreviewConfirmVisible(true)
            }}
          >
            试运行
          </Button>
          {!record.company_id && (
            <Button
              type="link"
              onClick={() => {
                if (myCompanies.length === 0) {
                  message.warning('请先创建公司')
                  return
                }
                setAgentToAssign(record)
                setSelectedCompanyForAssign(undefined)
                setAssignModalVisible(true)
              }}
            >
              分配
            </Button>
          )}
          <Button
            type="link"
            onClick={() => {
              Modal.confirm({
                title: '发布到市场',
                content: (
                  <div>
                    <p>确定要将员工「{record.name}」发布到市场吗？</p>
                    <Input
                      type="number"
                      placeholder="请输入售价（游戏币，最低100）"
                      min={100}
                      id="sell-price-input"
                      style={{ marginTop: '12px' }}
                    />
                  </div>
                ),
                okText: '发布',
                cancelText: '取消',
                onOk: async () => {
                  const priceInput = document.getElementById('sell-price-input') as HTMLInputElement
                  const price = parseInt(priceInput?.value || '0')
                  
                  if (price < 100) {
                    message.error('售价不能低于100游戏币')
                    return Promise.reject()
                  }
                  
                  try {
                    const res = await apiClient.post<{ success: boolean; message: string }>(
                      `/agents/${record.id}/sell`,
                      { price }
                    )
                    if (res.success) {
                      message.success('已发布到市场')
                      refetch()
                    } else {
                      message.error(res.message || '发布失败')
                    }
                  } catch (error: any) {
                    message.error(error?.response?.data?.message || '发布失败')
                    return Promise.reject()
                  }
                },
              })
            }}
          >
            发布
          </Button>
          <Button
            type="link"
            danger
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除员工「${record.name}」吗？此操作不可恢复。${record.company_id ? ' 注意：该员工正在公司任职，删除前需要先解雇。' : ''}`,
                okText: '确认删除',
                okType: 'danger',
                cancelText: '取消',
                onOk: async () => {
                  try {
                    const res = await apiClient.delete<{ success: boolean; message: string }>(
                      `/agents/${record.id}`
                    )
                    if (res.success) {
                      message.success('删除成功')
                      refetch()
                    } else {
                      message.error(res.message || '删除失败')
                    }
                  } catch (error: any) {
                    message.error(error?.response?.data?.message || '删除失败')
                  }
                },
              })
            }}
          >
            删除
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

      {/* 试运行确认弹窗 */}
      <Modal
        open={previewConfirmVisible}
        title="确认试运行"
        onOk={() => {
          if (pendingPreviewAgent) {
            setPreviewAgent(pendingPreviewAgent)
            setPreviewConfirmVisible(false)
            setPendingPreviewAgent(null)
          }
        }}
        onCancel={() => {
          setPreviewConfirmVisible(false)
          setPendingPreviewAgent(null)
        }}
        okText="确认运行"
        cancelText="取消"
      >
        <Space direction="vertical">
          <Text style={{ color: '#FFD76E' }}>即将使用默认配置试运行员工：<Text strong style={{ color: '#d4af37' }}>{pendingPreviewAgent?.name}</Text></Text>
          <Text style={{ color: '#e8c468' }}>• 项目名称：{pendingPreviewAgent?.name}的试运行项目</Text>
          <Text style={{ color: '#e8c468' }}>• 游戏类型：RPG</Text>
          <Text style={{ color: '#e8c468' }}>• 执行阶段：{pendingPreviewAgent && agentStageMap[pendingPreviewAgent.type]}</Text>
          <Alert
            type="info"
            message="试运行会消耗AI模型调用额度，确认要继续吗？"
            showIcon
          />
        </Space>
      </Modal>

      {/* 试运行结果弹窗 */}
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
        afterOpenChange={(open) => {
          if (open && previewAgent && !previewResult && !loading) {
            handlePreviewWithDefaults(previewAgent)
          }
        }}
      >
        {previewAgent && (
          <div className="space-y-4">
            <Alert
              type="info"
              message={`该员工正在按 ${agentStageMap[previewAgent.type] || 'planning'} 阶段执行试运行任务，使用默认配置`}
              showIcon
            />

            {loading && (
              <Card size="small">
                <Space>
                  <Text>正在执行试运行...</Text>
                </Space>
              </Card>
            )}

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
          setCreateMode('form')
          setConversationalMessages([])
          setSelectedCompanyForConv(undefined)
          createForm.resetFields()
        }}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Tabs activeKey={createMode} onChange={(key) => setCreateMode(key as 'form' | 'chat')}>
          <Tabs.TabPane tab="📝 表单创建" key="form">
            <Form 
              form={createForm} 
              layout="vertical" 
              onFinish={handleCreateAgent}
          onValuesChange={(changedValues) => {
            if (changedValues.type) {
              setSelectedType(changedValues.type)
              // 切换类型时清空专业字段
              createForm.setFieldsValue({ specialization: undefined, ai_model: undefined, ai_model_2d: undefined, ai_model_3d: undefined, dimension: undefined })
            }
            if (changedValues.dimension) {
              setSelectedDimension(changedValues.dimension)
              // 切换维度时清空模型字段
              createForm.setFieldsValue({ ai_model_2d: undefined, ai_model_3d: undefined })
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
              <Select.Option value="architect">架构师</Select.Option>
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

          {selectedType === 'artist' && selectedDimension === '3d' && (
            <>
              <Form.Item
                name="ai_model_2d"
                label="2D模型（贴图/原画）"
                tooltip="用于生成贴图、概念图等2D资产"
                initialValue="dall-e-3"
              >
                <Select 
                  placeholder="选择2D模型" 
                  options={aiModelOptions.artist3d_2d || []}
                />
              </Form.Item>
              <Form.Item
                name="ai_model_3d"
                label="3D模型（模型生成）"
                tooltip="用于生成3D模型资产"
                initialValue="meshy-4"
              >
                <Select 
                  placeholder="选择3D模型" 
                  options={aiModelOptions.artist3d_3d || []}
                />
              </Form.Item>
            </>
          )}

          {selectedType === 'artist' && selectedDimension === '2d' && (
            <Form.Item
              name="ai_model_2d"
              label="AI模型"
              tooltip="用于生成2D美术资产"
              initialValue="dall-e-3"
            >
              <Select 
                placeholder="选择AI模型" 
                options={aiModelOptions.artist2d || []}
              />
            </Form.Item>
          )}

          {selectedType && selectedType !== 'artist' && (
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
            message={<span style={{ color: '#FFD76E' }}>提示</span>}
            description={<span style={{ color: '#d4c5a9' }}>员工可以立即分配到公司开始工作。AI模型和额外特点会影响agent的实际执行效果。</span>}
            showIcon
            style={{ 
              marginBottom: 16,
              background: 'rgba(40, 25, 15, 0.6)',
              border: '1px solid rgba(200, 140, 80, 0.3)'
            }}
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
          </Tabs.TabPane>
          <Tabs.TabPane tab="💬 对话创建" key="chat">
            <div style={{ marginBottom: 16 }}>
              <Alert
                message={<span style={{ color: '#FFD76E' }}>智能对话助手</span>}
                description={<span style={{ color: '#d4c5a9' }}>通过对话，我将帮您创建员工并分配到指定公司。</span>}
                type="info"
                showIcon
                style={{ 
                  background: 'rgba(40, 25, 15, 0.6)',
                  border: '1px solid rgba(200, 140, 80, 0.3)'
                }}
              />
              <div style={{ marginTop: 12 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text style={{ color: '#d4af37', fontWeight: 600 }}>🤖 AI模型:</Text>
                    <Select
                      value={conversationalModel}
                      style={{ width: '100%', marginTop: 4 }}
                      options={[
                        { label: 'GPT-4o（推荐）', value: 'gpt-4o' },
                        { label: 'GPT-5', value: 'gpt-5' },
                        { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
                        { label: 'DeepSeek R1', value: 'deepseek-r1' },
                      ]}
                      onChange={setConversationalModel}
                    />
                  </div>
                  <div>
                    <Text style={{ color: '#c8a060' }}>分配到公司：</Text>
                    <Select 
                      placeholder="请选择公司" 
                      style={{ width: '100%', marginTop: 4 }}
                      value={selectedCompanyForConv}
                      onChange={setSelectedCompanyForConv}
                    >
                      {myCompanies.map((company: any) => (
                        <Select.Option key={company.id} value={company.id}>
                          {company.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>
                </Space>
              </div>
            </div>
            <div style={{ 
              height: '350px', 
              overflowY: 'auto', 
              border: '1px solid rgba(200, 140, 80, 0.3)', 
              borderRadius: '4px', 
              padding: '12px',
              marginBottom: '12px',
              background: 'rgba(40, 25, 15, 0.3)'
            }}>
              {conversationalMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#c8a060' }}>
                  <Text style={{ fontSize: '16px' }}>👋 你好！我是雇佣助手</Text><br/>
                  <Text style={{ fontSize: '14px', color: '#d4c5a9' }}>请告诉我您需要什么类型的员工？</Text>
                </div>
              ) : (
                conversationalMessages.map((msg, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: msg.role === 'user' 
                        ? 'linear-gradient(135deg, rgba(180, 120, 60, 0.6), rgba(120, 70, 30, 0.7))'
                        : 'rgba(40, 25, 15, 0.6)',
                      border: '1px solid rgba(200, 140, 80, 0.3)',
                      color: '#f5e6d3'
                    }}>
                      <Text style={{ color: msg.role === 'user' ? '#FFD76E' : '#e8c468', fontSize: '12px' }}>
                        {msg.role === 'user' ? '👤 您' : '🤖 助手'}
                      </Text>
                      <div style={{ marginTop: '4px', color: '#f5e6d3', whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {conversationalLoading && (
                <div style={{ textAlign: 'center', color: '#c8a060' }}>
                  <Text>🤔 思考中...</Text>
                </div>
              )}
            </div>
            <Space.Compact style={{ width: '100%', marginTop: 12 }}>
              <Input.TextArea
                rows={3}
                value={conversationalInput}
                onChange={(e) => setConversationalInput(e.target.value)}
                placeholder="输入您的想法，按Enter发送，Shift+Enter换行..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (!conversationalLoading && conversationalInput.trim() && selectedCompanyForConv) {
                      handleConversationalAgentSend()
                    }
                  }
                }}
                disabled={conversationalLoading || !selectedCompanyForConv}
                style={{ flex: 1 }}
              />
              <Button 
                type="primary" 
                onClick={handleConversationalAgentSend}
                loading={conversationalLoading}
                disabled={!selectedCompanyForConv || !conversationalInput.trim()}
                style={{ alignSelf: 'flex-end' }}
              >
                发送
              </Button>
            </Space.Compact>
          </Tabs.TabPane>
        </Tabs>
      </Modal>

      {/* 分配员工到公司的Modal */}
      <Modal
        title="分配员工到公司"
        open={assignModalVisible}
        onCancel={() => {
          setAssignModalVisible(false)
          setAgentToAssign(null)
          setSelectedCompanyForAssign(undefined)
        }}
        onOk={async () => {
          if (!agentToAssign || !selectedCompanyForAssign) {
            message.error('请选择公司')
            return
          }
          
          try {
            const res = await apiClient.post<{ success: boolean; message: string }>(
              `/agents/${agentToAssign.id}/assign`,
              { company_id: selectedCompanyForAssign }
            )
            if (res.success) {
              message.success(res.message || '分配成功')
              setAssignModalVisible(false)
              setAgentToAssign(null)
              setSelectedCompanyForAssign(undefined)
              refetch()
            } else {
              message.error(res.message || '分配失败')
            }
          } catch (error: any) {
            message.error(error?.response?.data?.message || '分配失败')
          }
        }}
        okText="确认分配"
        cancelText="取消"
        centered
      >
        {agentToAssign && (
          <div>
            <p style={{ color: '#d4c5a9' }}>
              将员工「<strong style={{ color: '#d4af37' }}>{agentToAssign.name}</strong>」分配到哪个公司？
            </p>
            <Select
              placeholder="选择公司"
              style={{ width: '100%', marginTop: '12px' }}
              value={selectedCompanyForAssign}
              onChange={setSelectedCompanyForAssign}
              options={myCompanies.map((c: any) => ({
                label: c.name,
                value: c.id,
              }))}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Agents