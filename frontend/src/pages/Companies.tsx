import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'react-query'
import {
  Alert,
  Button,
  Card,
  Carousel,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { LeftOutlined, RightOutlined, UploadOutlined } from '@ant-design/icons'
import { apiClient } from '../services/api'
import { ConceptImageUpload } from '../components/ConceptImageUpload'
import type {
  ClarificationState,
  Company,
  WorkflowJobState,
  WorkflowCapacity,
  WorkflowStageStatus,
} from '../types'

// 类型定义
type ClarificationModalState = {
  visible: boolean
  executionId: string
  jobId: string
}

type StageControlState = {
  visible: boolean
  action: 'pause' | 'resume'
  stageId: string
  executionId: string
  jobId: string
}

type CompanyFormValues = {
  name: string
  description?: string
  maxEmployees: number
  workflowType: string
  initialCapital: number
  workflowPrompt?: string
}

type WorkflowFormValues = {
  projectName: string
  executionMode: string
  description?: string
  primaryGenre?: string
  subGenre?: string
  hybridGenres?: string[]
  dimension?: string
  artStyle?: string
  gameMode?: string
  planningCapabilities?: string[]
  planningSystems?: string[]
  cloudProvider: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const executionModes = [
  { label: '顺序', value: 'sequential' },
  { label: '并发', value: 'concurrent' },
]

// 辅助函数
const formatEta = (ms: number): string => {
  if (ms < 60000) return `${Math.round(ms / 1000)}秒`
  if (ms < 3600000) return `${Math.round(ms / 60000)}分钟`
  return `${Math.round(ms / 3600000)}小时`
}

const buildGenreSelection = (values: WorkflowFormValues) => {
  return {
    primary: values.primaryGenre || 'rpg',
    subGenre: values.subGenre,
    hybrid: values.hybridGenres,
  }
}

const buildPlanningFocus = (values: WorkflowFormValues) => {
  if (!values.planningCapabilities && !values.planningSystems) return null
  return {
    narrative: values.planningCapabilities?.includes('narrative'),
    numeric: values.planningCapabilities?.includes('numeric'),
    levelDesign: values.planningCapabilities?.includes('level'),
    systemDesign: {
      growth: values.planningSystems?.includes('growth'),
      equipment: values.planningSystems?.includes('equipment'),
      social: values.planningSystems?.includes('social'),
      combat: values.planningSystems?.includes('combat'),
    },
  }
}

// CompanyEmployeesCard组件
const CompanyEmployeesCard: React.FC<{ companyId?: number; embedded?: boolean }> = ({ companyId, embedded }) => {
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [recruitModalVisible, setRecruitModalVisible] = useState(false)
  const [availableAgents, setAvailableAgents] = useState<any[]>([])
  const [recruitLoading, setRecruitLoading] = useState(false)

  useEffect(() => {
    if (!companyId) {
      setEmployees([])
      return
    }
    setLoading(true)
    apiClient.get<{ success: boolean; data: any[] }>(`/companies/${companyId}/employees`)
      .then((res) => {
        setEmployees(res.data || [])
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [companyId])

  const loadAvailableAgents = async () => {
    setRecruitLoading(true)
    try {
      // 获取自己的自由员工
      const myAgentsRes = await apiClient.get<{ success: boolean; data: any[] }>('/agents/my?status=available')
      const myAgents = (myAgentsRes.data || []).map((a: any) => ({ ...a, source: 'own' }))
      
      // 获取市场上的员工 - 静默失败，不影响主功能
      let marketAgents: any[] = []
      try {
        const marketRes = await apiClient.get<{ success: boolean; data: any[] }>('/market/listings?type=agent')
        marketAgents = (marketRes.data || []).map((a: any) => ({ ...a, source: 'market' }))
      } catch (marketError) {
        // 静默处理市场获取失败，不显示错误消息
        console.log('市场功能暂不可用')
      }
      
      setAvailableAgents([...myAgents, ...marketAgents])
    } catch (error: any) {
      // 只有获取自己的员工失败时才显示错误
      message.error(error?.response?.data?.message || '加载员工列表失败')
      setAvailableAgents([])
    } finally {
      setRecruitLoading(false)
    }
  }

  const handleOpenRecruitModal = () => {
    setRecruitModalVisible(true)
    loadAvailableAgents()
  }

  const handleRecruit = async (agent: any) => {
    if (!companyId) return
    
    try {
      if (agent.source === 'own') {
        // 分配自己的员工
        const res = await apiClient.post<{ success: boolean; message: string }>(
          `/agents/${agent.id}/assign`,
          { company_id: companyId }
        )
        if (res.success) {
          message.success(res.message || '招募成功')
          setRecruitModalVisible(false)
          // 刷新员工列表
          setLoading(true)
          apiClient.get<{ success: boolean; data: any[] }>(`/companies/${companyId}/employees`)
            .then((res) => setEmployees(res.data || []))
            .finally(() => setLoading(false))
        } else {
          message.error(res.message || '招募失败')
        }
      } else {
        // 从市场购买员工
        const res = await apiClient.post<{ success: boolean; message: string }>(
          `/market/listings/${agent.listing_id || agent.id}/buy`,
          { company_id: companyId }
        )
        if (res.success) {
          message.success('购买并招募成功')
          setRecruitModalVisible(false)
          // 刷新员工列表
          setLoading(true)
          apiClient.get<{ success: boolean; data: any[] }>(`/companies/${companyId}/employees`)
            .then((res) => setEmployees(res.data || []))
            .finally(() => setLoading(false))
        } else {
          message.error(res.message || '购买失败')
        }
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败')
    }
  }

  const employeeColumns = [
    { title: '姓名', dataIndex: 'name', width: 120 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (value: string) => {
        const typeColorMap: Record<string, string> = {
          planner: 'rgba(64, 169, 255, 0.3)',
          architect: 'rgba(19, 194, 194, 0.3)',
          artist: 'rgba(235, 47, 150, 0.3)',
          developer: 'rgba(82, 196, 26, 0.3)',
          tester: 'rgba(250, 140, 22, 0.3)',
          operator: 'rgba(114, 46, 209, 0.3)',
          music: 'rgba(250, 173, 20, 0.3)',
        }
        const borderColorMap: Record<string, string> = {
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
        )
      },
    },
    {
      title: '专业',
      dataIndex: 'specialization',
      width: 120,
      render: (value: string) => value || '--',
    },
    {
      title: 'AI模型',
      dataIndex: 'ai_model',
      render: (model: string, record: any) => {
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
          return { bg: 'rgba(47, 84, 235, 0.3)', border: 'rgba(47, 84, 235, 0.6)' }
        }
        
        const displayModel = record.ai_model || model || '默认模型'
        const colors = getModelColor(displayModel)
        return (
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
          }}>{displayModel}</span>
        )
      },
    },
  ]

  if (embedded) {
    return (
      <>
        <Card 
          title="公司员工" 
          loading={loading}
          extra={
            <Button type="primary" size="small" onClick={handleOpenRecruitModal}>
              ➕ 招募员工
            </Button>
          }
        >
          {employees.length === 0 ? (
            <Alert
              message="暂无员工"
              description="点击右上角「招募员工」按钮招募"
              type="warning"
              showIcon
            />
          ) : (
            <Table
              size="small"
              dataSource={employees}
              columns={employeeColumns}
              pagination={false}
              rowKey="id"
            />
          )}
        </Card>

        <Modal
          title="招募员工"
          open={recruitModalVisible}
          onCancel={() => setRecruitModalVisible(false)}
          footer={null}
          width={900}
          centered
        >
          <Tabs>
            <Tabs.TabPane tab="我的自由员工" key="own">
              {recruitLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
              ) : (
                <Table
                  size="small"
                  dataSource={availableAgents.filter((a: any) => a.source === 'own')}
                  columns={[
                    ...employeeColumns,
                    {
                      title: '操作',
                      width: 80,
                      render: (_: any, agent: any) => (
                        <Button type="primary" size="small" onClick={() => handleRecruit(agent)}>
                          招募
                        </Button>
                      ),
                    },
                  ]}
                  pagination={false}
                  rowKey="id"
                  locale={{ emptyText: '暂无可招募的自由员工' }}
                />
              )}
            </Tabs.TabPane>
            <Tabs.TabPane tab="市场员工" key="market">
              {recruitLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
              ) : (
                <Table
                  size="small"
                  dataSource={availableAgents.filter((a: any) => a.source === 'market')}
                  columns={[
                    ...employeeColumns,
                    {
                      title: '售价',
                      dataIndex: 'price',
                      width: 80,
                      render: (price: number) => (
                        <Typography.Text strong style={{ color: '#faad14' }}>{price || 0} 币</Typography.Text>
                      ),
                    },
                    {
                      title: '操作',
                      width: 80,
                      render: (_: any, agent: any) => (
                        <Button type="primary" size="small" onClick={() => handleRecruit(agent)}>
                          购买
                        </Button>
                      ),
                    },
                  ]}
                  pagination={false}
                  rowKey={(record) => record.id || record.listing_id}
                  locale={{ emptyText: '市场暂无可招募员工' }}
                />
              )}
            </Tabs.TabPane>
          </Tabs>
        </Modal>
      </>
    )
  }

  return (
    <>
      <Card 
        title="公司员工" 
        loading={loading}
        extra={
          <Button type="primary" size="small" onClick={handleOpenRecruitModal}>
            ➕ 招募员工
          </Button>
        }
      >
        {employees.length === 0 ? (
          <Alert
            message="暂无员工"
            description="点击右上角「招募员工」按钮招募"
            type="warning"
            showIcon
          />
        ) : (
          <Table
            size="small"
            dataSource={employees}
            columns={employeeColumns}
            pagination={false}
            rowKey="id"
          />
        )}
      </Card>

      <Modal
        title="招募员工"
        open={recruitModalVisible}
        onCancel={() => setRecruitModalVisible(false)}
        footer={null}
        width={900}
        centered
      >
        <Tabs>
          <Tabs.TabPane tab="我的自由员工" key="own">
            {recruitLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
            ) : (
              <Table
                size="small"
                dataSource={availableAgents.filter((a: any) => a.source === 'own')}
                columns={[
                  ...employeeColumns,
                  {
                    title: '操作',
                    width: 80,
                    render: (_: any, agent: any) => (
                      <Button type="primary" size="small" onClick={() => handleRecruit(agent)}>
                        招募
                      </Button>
                    ),
                  },
                ]}
                pagination={false}
                rowKey="id"
                locale={{ emptyText: '暂无可招募的自由员工' }}
              />
            )}
          </Tabs.TabPane>
          <Tabs.TabPane tab="市场员工" key="market">
            {recruitLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>
            ) : (
              <Table
                size="small"
                dataSource={availableAgents.filter((a: any) => a.source === 'market')}
                columns={[
                  ...employeeColumns,
                  {
                    title: '售价',
                    dataIndex: 'price',
                    width: 80,
                    render: (price: number) => (
                      <Typography.Text strong style={{ color: '#faad14' }}>{price || 0} 币</Typography.Text>
                    ),
                  },
                  {
                    title: '操作',
                    width: 80,
                    render: (_: any, agent: any) => (
                      <Button type="primary" size="small" onClick={() => handleRecruit(agent)}>
                        购买
                      </Button>
                    ),
                  },
                ]}
                pagination={false}
                rowKey={(record) => record.id || record.listing_id}
                locale={{ emptyText: '市场暂无可招募员工' }}
              />
            )}
          </Tabs.TabPane>
        </Tabs>
      </Modal>
    </>
  )
}

// StageControlModal组件
const StageControlModal: React.FC<{
  state: StageControlState
  onSubmit: (notes?: string) => void
  onCancel: () => void
}> = ({ state, onSubmit, onCancel }) => {
  const [notes, setNotes] = useState('')
  if (!state.visible) return null
  return (
    <Modal
      open={state.visible}
      title={state.action === 'pause' ? '暂停阶段' : '恢复阶段'}
      onOk={() => onSubmit(notes)}
      onCancel={onCancel}
    >
      <Input.TextArea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="可选：添加备注说明"
      />
    </Modal>
  )
}

// 组件入口
const Companies: React.FC = () => {
    const [companyTabKey, setCompanyTabKey] = useState<'overview' | 'workflow'>('overview')
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | undefined>(undefined)

    const [createCompanyModalVisible, setCreateCompanyModalVisible] = useState(false)
    const [createMode, setCreateMode] = useState<'form' | 'chat'>('form')
    const [companyForm] = Form.useForm()
    const [form] = Form.useForm()
    const [fundForm] = Form.useForm()

    const [fundModalVisible, setFundModalVisible] = useState(false)
    const [assetUploadVisible, setAssetUploadVisible] = useState(false)  // 资源上传模态框

    const [executeModalVisible, setExecuteModalVisible] = useState(false)
    const [executePrompt, setExecutePrompt] = useState('')
    const [executeCompanyId, setExecuteCompanyId] = useState<number | undefined>(undefined)
    const [executeModalLoading, setExecuteModalLoading] = useState(false)

    const [conversationalMessages, setConversationalMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
    const [conversationalInput, setConversationalInput] = useState('')
    const [conversationalLoading, setConversationalLoading] = useState(false)
    const [conversationalModel, setConversationalModel] = useState('gpt-4o')
    const [conversationalState, setConversationalState] = useState<any>({ phase: 'company', companyId: undefined, createdEmployees: [] })

    const [jobs, setJobs] = useState<Record<string, WorkflowJobState>>({})
    const [loadingQueue, setLoadingQueue] = useState(false)

    const clarStreamController = useRef<AbortController | null>(null)
    const carouselRef = useRef<any>(null)
    const [clarification, setClarification] = useState<ClarificationState | null>(null)
    const [clarificationModal, setClarificationModal] = useState<ClarificationModalState>({ visible: false, executionId: '', jobId: '' })
    const [clarResponses, setClarResponses] = useState<Record<string, string>>({})
    const [clarLoading, setClarLoading] = useState(false)

    const [controlModal, setControlModal] = useState<StageControlState>({ visible: false, action: 'pause', stageId: '', executionId: '', jobId: '' })

    // 公司列表（react-query）
    const { data: companiesRes, refetch: refetchCompanies } = useQuery(['companies'], async () => apiClient.get<{ success: boolean; data: Company[] }>('/companies'))

    // 生产线容量（简要）
    const capacityRes = useQuery(['capacity'], async () => apiClient.get<{ success: boolean; data: WorkflowCapacity }>('/workflows/capacity'))

    // 已解散公司历史
    const [dissolvedCompanies, setDissolvedCompanies] = useState<any[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const historyQuery = useQuery(['companies_history'], async () => apiClient.get<{ success: boolean; data: any[] }>('/companies/history'), {
      enabled: false,
      onSuccess: (res) => setDissolvedCompanies(res.data || []),
      onSettled: () => setHistoryLoading(false),
    })
    const refetchHistory = useCallback(() => {
      setHistoryLoading(true)
      void historyQuery.refetch()
    }, [historyQuery])

    const selectedCompany = useMemo(() => companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId), [companiesRes, selectedCompanyId])

    // 自动选择第一个公司
    useEffect(() => {
      if (companiesRes?.data && companiesRes.data.length > 0 && !selectedCompanyId) {
        setSelectedCompanyId(companiesRes.data[0].id)
      }
    }, [companiesRes?.data, selectedCompanyId])

    // 轮播切换时更新选中的公司
    const handleCarouselChange = useCallback((current: number) => {
      if (companiesRes?.data && companiesRes.data[current]) {
        setSelectedCompanyId(companiesRes.data[current].id)
      }
    }, [companiesRes?.data])

    const [historyModalVisible, setHistoryModalVisible] = useState(false)

    const fetchJobList = useCallback(async () => {
      if (!selectedCompanyId) return
      setLoadingQueue(true)
      try {
        const res = await apiClient.get<{ success: boolean; data: WorkflowJobState[] }>(
          '/workflows/jobs',
          { companyId: selectedCompanyId }
        )
        if (res.success) {
          const mapped = res.data.reduce<Record<string, WorkflowJobState>>((acc, job) => {
            acc[job.jobId] = job
            return acc
          }, {})
          setJobs(mapped)
        }
      } catch (error) {
        console.error('加载任务列表失败', error)
      } finally {
        setLoadingQueue(false)
      }
    }, [selectedCompanyId])

    const closeHistoryModal = useCallback(() => {
      setHistoryModalVisible(false)
    }, [])

    const refreshJob = useCallback(
    async (jobId: string) => {
      try {
        const jobRes = await apiClient.get<{ success: boolean; data: WorkflowJobState }>(
          `/workflows/jobs/${jobId}`
        )
        if (!jobRes.success) return
        const jobData = jobRes.data
        let stageList: WorkflowStageStatus[] = jobs[jobId]?.stages || []

        if (jobData.executionId) {
          try {
            const execRes = await apiClient.get<{ success: boolean; data: any }>(
              `/workflows/executions/${jobData.executionId}`
            )
            if (execRes.success) {
              const execution = execRes.data
              stageList = Object.entries(execution.stages || {}).map(
                ([stageId, stage]: [string, any]) => ({
                  stageId,
                  status: stage.status,
                  startedAt: stage.startedAt,
                  completedAt: stage.completedAt,
                  artifacts: stage.artifacts,
                  notes: stage.userUpdates?.notes,
                })
              )
            }
          } catch (err) {
            console.warn('获取执行详情失败', err)
          }
        }

        setJobs((prev) => ({
          ...prev,
          [jobId]: {
            ...prev[jobId],
            ...jobData,
            stages: stageList,
          },
        }))
      } catch (error) {
        console.error('刷新任务失败', error)
      }
    },
    [jobs]
  )

  const disconnectClarificationStream = useCallback(() => {
    if (clarStreamController.current) {
      clarStreamController.current.abort()
      clarStreamController.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      disconnectClarificationStream()
    }
  }, [disconnectClarificationStream])

  const handleClarificationEvent = useCallback((eventType: string, payload: any) => {
    if (eventType === 'clarification') {
      setClarification(payload as ClarificationState)
    } else if (eventType === 'snapshot' && payload?.clarification) {
      setClarification(payload.clarification as ClarificationState)
    }
  }, [])

  const parseSseChunk = useCallback(
    (chunk: string) => {
      let eventType = 'message'
      let data = ''
      chunk.split('\n').forEach((line) => {
        if (line.startsWith('event:')) {
          eventType = line.replace('event:', '').trim()
        } else if (line.startsWith('data:')) {
          data += line.slice(5).trim()
        }
      })
      if (data) {
        try {
          handleClarificationEvent(eventType, JSON.parse(data))
        } catch (error) {
          console.warn('解析事件失败', error)
        }
      }
    },
    [handleClarificationEvent]
  )

  const connectClarificationStream = useCallback(
    async (executionId: string) => {
      disconnectClarificationStream()
      const token = localStorage.getItem('token')
      if (!token) return
      const controller = new AbortController()
      clarStreamController.current = controller
      try {
        const response = await fetch(`${API_BASE_URL}/workflows/executions/${executionId}/events`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        })
        if (!response.ok || !response.body) {
          throw new Error('事件流连接失败')
        }
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value) continue
          buffer += decoder.decode(value, { stream: true })
          let boundary = buffer.indexOf('\n\n')
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            if (chunk.trim()) {
              parseSseChunk(chunk)
            }
            boundary = buffer.indexOf('\n\n')
          }
        }
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          console.warn('澄清事件流结束', error)
        }
      }
    },
    [disconnectClarificationStream, parseSseChunk]
  )

  const loadClarification = useCallback(
    async (executionId: string) => {
      try {
        const res = await apiClient.get<{ success: boolean; data: ClarificationState }>(
          `/workflows/executions/${executionId}/clarifications`
        )
        if (res.success) {
          setClarification(res.data)
        }
      } catch (error) {
        console.error('加载澄清信息失败', error)
      }
    },
    []
  )

  useEffect(() => {
    if (!Object.keys(jobs).length) return
    const interval = setInterval(() => {
      Object.keys(jobs).forEach((jobId) => {
        refreshJob(jobId)
      })
    }, 20000)
    return () => clearInterval(interval)
  }, [jobs, refreshJob])

  useEffect(() => {
    fetchJobList()
  }, [fetchJobList])

  const openClarificationModal = useCallback(
    async (job: WorkflowJobState) => {
      if (!job.executionId) return
      setClarificationModal({
        visible: true,
        executionId: job.executionId,
        jobId: job.jobId,
      })
      setClarResponses({})
      await loadClarification(job.executionId)
      void connectClarificationStream(job.executionId)
    },
    [connectClarificationStream, loadClarification]
  )

  const closeClarificationModal = useCallback(() => {
    setClarificationModal({
      visible: false,
      executionId: '',
      jobId: '',
    })
    setClarification(null)
    setClarResponses({})
    disconnectClarificationStream()
  }, [disconnectClarificationStream])

  const handleClarificationInput = useCallback((questionId: string, value: string) => {
    setClarResponses((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  const handleClarificationSubmit = useCallback(async () => {
    if (!clarificationModal.executionId || !clarification) return
    const pending = clarification.questions.filter((q) => q.status === 'open')
    const payload = pending
      .map((question) => ({
        questionId: question.questionId,
        answer: (clarResponses[question.questionId] || '').trim(),
      }))
      .filter((item) => item.answer)

    if (!payload.length) {
      message.warning('请至少填写一个回答')
      return
    }

    try {
      setClarLoading(true)
      await apiClient.post(`/workflows/executions/${clarificationModal.executionId}/clarifications`, {
        responses: payload,
      })
      message.success('澄清信息已提交')
      setClarResponses({})
      await loadClarification(clarificationModal.executionId)
      refreshJob(clarificationModal.jobId)
    } catch (error: any) {
      message.error(error?.response?.data?.message || '提交失败')
    } finally {
      setClarLoading(false)
    }
  }, [clarificationModal, clarification, clarResponses, loadClarification, refreshJob])

  const handleCreateCompany = async (values: CompanyFormValues) => {
    try {
      const res = await apiClient.post<{ success: boolean; data: Company }>('/companies', {
        name: values.name,
        description: values.description,
        max_employees: values.maxEmployees,
        workflow_type: values.workflowType,
        initial_capital: values.initialCapital,
        workflowConfig: values.workflowPrompt ? { prompt: values.workflowPrompt } : undefined,
      })

      if (res.success) {
        message.success('公司创建成功')
        setCreateCompanyModalVisible(false)
        companyForm.resetFields()
        // 刷新公司列表并自动选择新公司
        await refetchCompanies?.()
        if (res.data?.id) {
          setSelectedCompanyId(res.data.id)
        }
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '创建公司失败')
    }
  }

  const handleDissolveCompany = async () => {
    if (!selectedCompanyId) return

    const selectedCompany = companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId)
    if (!selectedCompany) return

    Modal.confirm({
      title: '确认解散公司？',
      content: (
        <div>
          <p>您确定要解散公司「{selectedCompany.name}」吗？</p>
          <p style={{ color: '#52c41a', fontWeight: 600 }}>✅ 剩余资金：{selectedCompany.currentCapital} 游戏币将退回您的账户</p>
          <p style={{ color: '#faad14' }}>⚠️ 公司员工将被遣散或流入市场</p>
          <p style={{ color: '#ff4d4f' }}>❌ 此操作不可撤销！</p>
        </div>
      ),
      okText: '确认解散',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(`${API_BASE_URL}/companies/${selectedCompanyId}/dissolve`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          })

          const data = await response.json()

            if (data.success) {
            message.success(
              `公司已解散！退还资金 ${data.data.refundAmount} 游戏币，处理员工 ${data.data.employeesProcessed} 名`
            )
            refetchCompanies?.()
            setSelectedCompanyId(undefined)
            refetchHistory()
          } else {
            message.error(data.message || '解散公司失败')
          }
        } catch (error) {
          console.error('解散公司失败:', error)
          message.error('解散公司失败，请重试')
        }
      },
    })
  }

  const handleConversationalSend = async () => {
    if (!conversationalInput.trim() || conversationalLoading) return

    setConversationalLoading(true)
    const userMessage = conversationalInput.trim()
    const newMessages = [...conversationalMessages, { role: 'user' as const, content: userMessage }]
    setConversationalMessages(newMessages)
    setConversationalInput('')

    let assistantMessage = ''
    setConversationalMessages([...newMessages, { role: 'assistant' as const, content: '' }])

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
      const token = localStorage.getItem('token')
      
      const response = await fetch(`${API_BASE_URL}/companies/conversational`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          model: conversationalModel,
          conversationHistory: conversationalMessages,
          state: conversationalState
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
              } else if (parsed.type === 'ask_execute') {
                // 后端显式请求是否立即执行工作流，并提供建议的结构化项目
                const suggested = parsed.suggestedProject || {}
                setExecutePrompt(suggested.additionalRequirements || JSON.stringify(suggested, null, 2) || assistantMessage)
                setExecuteCompanyId(parsed.companyId || conversationalState.companyId)
                setExecuteModalVisible(true)
              } else if (parsed.type === 'success') {
                assistantMessage = parsed.content
                setConversationalMessages([...newMessages, { role: 'assistant', content: assistantMessage }])
                
                if (parsed.companyId) {
                  setConversationalState({ 
                    phase: parsed.phase || 'employees', 
                    companyId: parsed.companyId,
                    createdEmployees: []
                  })
                  message.success('公司创建成功！接下来请为公司雇佣6位必需的员工：策划、架构师、美术、研发、测试、音频')
                  // 立即刷新公司列表
                  refetchCompanies?.()
                } else if (parsed.agentId) {
                  const currentEmployees = conversationalState.createdEmployees || []
                  setConversationalState({
                    ...conversationalState,
                    createdEmployees: [...currentEmployees, parsed.agentType]
                  })
                  message.success(`员工创建成功！已创建 ${currentEmployees.length + 1}/6 位员工`)
                  // 如果6个员工都创建完成，刷新并关闭对话框
                  if (currentEmployees.length + 1 >= 6) {
                    message.success('🎉 公司和所有员工创建完成！')
                    // 打开执行确认模态，允许填写或接受 AI 建议的项目描述
                    setTimeout(() => {
                      setExecutePrompt(assistantMessage || '')
                      setExecuteCompanyId(conversationalState.companyId)
                      setExecuteModalVisible(true)
                    }, 500)
                  }
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

  const handleInjectFunds = async (values: { amount: number }) => {
    if (!selectedCompanyId) return

    try {
      const res = await apiClient.post<{ success: boolean }>(
        `/companies/${selectedCompanyId}/inject-funds`,
        { amount: values.amount }
      )

      if (res.success) {
        message.success(`成功注资 ${values.amount} 游戏币`)
        setFundModalVisible(false)
        fundForm.resetFields()
        // 刷新公司列表
        refetchCompanies?.()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '注资失败')
    }
  }

  const handleRunWorkflow = async (values: WorkflowFormValues) => {
    if (!selectedCompanyId) {
      message.warning('请先创建或选择公司')
      return
    }
    const planningFocus = buildPlanningFocus(values)
    const stageOverrides = planningFocus
      ? [
          {
            stageId: 'planning',
            planningFocus,
          },
        ]
      : undefined
    try {
      const res = await apiClient.post<{
        success: boolean
        jobId: string
        position: number
        etaMs: number
      }>(`/companies/${selectedCompanyId}/execute`, {
        project: {
          projectName: values.projectName,
          genre: buildGenreSelection(values),
          dimension: values.dimension,
          artStyle: values.artStyle,
          gameMode: values.gameMode,
          additionalRequirements: values.description,
        },
        executionMode: values.executionMode,
        cloudProvider: values.cloudProvider,
        ...(stageOverrides ? { stages: stageOverrides } : {}),
      })

      if (!res.success) {
        message.error('触发workflow失败')
        return
      }

      const jobState: WorkflowJobState = {
        jobId: res.jobId,
        status: 'queued',
        position: res.position,
        etaMs: res.etaMs,
      }

      setJobs((prev) => ({
        ...prev,
        [res.jobId]: jobState,
      }))
      message.success(`任务 ${res.jobId} 已进入队列`)
    } catch (error: any) {
      message.error(error?.response?.data?.message || '触发workflow失败')
    }
  }

  const handleControlStage = async (notes?: string) => {
    const { action, executionId, stageId, jobId } = controlModal
    if (!executionId) return
    try {
      await apiClient.post(
        `/workflows/executions/${executionId}/stages/${stageId}/${action}`,
        { notes }
      )
      message.success(`${stageId} 已${action === 'pause' ? '暂停' : '恢复'}`)
      setControlModal((prev) => ({ ...prev, visible: false }))
      refreshJob(jobId)
    } catch (error: any) {
      message.error(error?.response?.data?.message || '操作失败')
    }
  }

  const jobList = useMemo(() => {
    return Object.values(jobs).sort((a, b) => {
      const aTime = new Date(a.createdAt || a.updatedAt || '').getTime()
      const bTime = new Date(b.createdAt || b.updatedAt || '').getTime()
      return bTime - aTime
    })
  }, [jobs])

  const pendingClarifications = useMemo(
    () => clarification?.questions.filter((q) => q.status === 'open') || [],
    [clarification]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Typography.Title level={2} className="!mb-0 bg3-title" style={{ 
          fontFamily: "'Cinzel Decorative', 'Microsoft YaHei', serif",
          fontSize: '32px',
          color: '#f5e6d3',
          textShadow: '0 3px 8px rgba(0, 0, 0, 0.9), 0 0 20px rgba(255, 180, 100, 0.5), 0 0 40px rgba(255, 120, 50, 0.3)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          filter: 'drop-shadow(0 0 15px rgba(255, 150, 80, 0.6))',
          position: 'relative',
          display: 'inline-block'
        }}>
          🔥 游戏工厂 - 公司管理中心 🔥
        </Typography.Title>
        <Space wrap>
          <Button type="primary" size="large" onClick={() => setCreateCompanyModalVisible(true)}>
            ✨ 创建公司
          </Button>
          <Button
            type="default"
            size="large"
            disabled={!selectedCompanyId}
            onClick={() => setFundModalVisible(true)}
          >
            💰 注资
          </Button>
          <Button size="large" onClick={() => {
            setHistoryModalVisible(true)
            refetchHistory()
          }}>
            📚 已解散公司
          </Button>
          {companiesRes?.data && companiesRes.data.length > 1 && (
            <Space.Compact size="large">
              <Button
                icon={<LeftOutlined />}
                onClick={() => carouselRef.current?.prev()}
                disabled={!selectedCompanyId}
              >
                上一个
              </Button>
              <Button
                style={{ minWidth: 220 }}
                disabled
              >
                🏛️ {selectedCompany?.name || '选择公司'}
              </Button>
              <Button
                icon={<RightOutlined />}
                onClick={() => carouselRef.current?.next()}
                disabled={!selectedCompanyId}
              >
                下一个
              </Button>
            </Space.Compact>
          )}
          {companiesRes?.data && companiesRes.data.length === 1 && (
            <Button size="large" disabled style={{ minWidth: 220 }}>
              🏛️ {selectedCompany?.name || '当前公司'}
            </Button>
          )}
        </Space>
      </div>

      {/* 隐藏的轮播控制器 */}
      {companiesRes?.data && companiesRes.data.length > 0 && (
        <div style={{ display: 'none' }}>
          <Carousel ref={carouselRef} afterChange={handleCarouselChange}>
            {companiesRes.data.map((company: Company) => (
              <div key={company.id}></div>
            ))}
          </Carousel>
        </div>
      )}

      <Row gutter={16}>
        <Col xs={24} lg={4}>
          <Card bordered style={{ background: 'linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, rgba(82, 196, 26, 0.05) 100%)' }}>
            <Statistic
              title="💰 公司资金"
              value={companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId)?.currentCapital ?? 0}
              suffix="币"
              valueStyle={{ color: '#52c41a', fontWeight: 700, fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={4}>
          <Card bordered style={{ background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0.05) 100%)' }}>
            <Statistic
              title="👥 公司员工"
              value={companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId)?.currentEmployees ?? 0}
              suffix={`/ ${companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId)?.maxEmployees ?? 0}`}
              valueStyle={{ color: '#1890ff', fontWeight: 700, fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={5}>
          <Card bordered style={{ background: 'linear-gradient(135deg, rgba(250, 173, 20, 0.1) 0%, rgba(250, 173, 20, 0.05) 100%)' }}>
            <Statistic
              title="📋 排队任务"
              value={capacityRes?.data?.data?.queued ?? 0}
              suffix="个"
              valueStyle={{ color: '#faad14', fontWeight: 700, fontSize: '28px' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={5}>
          <Card bordered>
            <Statistic
              title="运行中"
              value={capacityRes?.data?.data?.running ?? 0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card bordered>
            <Statistic
              title="平均耗时"
              value={Math.round((capacityRes?.data?.data?.avgDurationMs ?? 0) / 60000)}
              suffix="分钟/Stage"
            />
          </Card>
        </Col>
      </Row>

      <Card 
        title={selectedCompany ? `🎮 ${selectedCompany.name}` : "公司管理"}
        extra={selectedCompany && (
          <Space>
            <Tag color="green">当前公司</Tag>
            <Button 
              danger 
              size="small"
              onClick={handleDissolveCompany}
            >
              🔥 解散公司
            </Button>
          </Space>
        )}
      >
        {!selectedCompanyId ? (
          <Alert
            message={<span style={{ color: '#FFD76E' }}>请先创建公司</span>}
            description={<span style={{ color: '#d4c5a9' }}>您需要先创建一个游戏开发公司，然后才能启动项目。点击右上角的「创建公司」按钮开始。</span>}
            type="warning"
            showIcon
            style={{
              background: 'rgba(40, 25, 15, 0.6)',
              border: '1px solid rgba(200, 140, 80, 0.3)'
            }}
          />
        ) : (
          <Tabs activeKey={companyTabKey} onChange={(key) => setCompanyTabKey(key as 'overview' | 'workflow')}>
            <Tabs.TabPane tab="公司概览" key="overview">
              <Row gutter={16}>
                <Col xs={24} lg={6}>
                  <Card bordered style={{ background: 'linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, rgba(82, 196, 26, 0.05) 100%)' }}>
                    <Statistic
                      title="💰 公司资金"
                      value={selectedCompany?.currentCapital ?? 0}
                      suffix="币"
                      valueStyle={{ color: '#52c41a', fontWeight: 700, fontSize: '28px' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={6}>
                  <Card bordered style={{ background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0.05) 100%)' }}>
                    <Statistic
                      title="👥 公司员工"
                      value={selectedCompany?.currentEmployees ?? 0}
                      suffix={`/ ${selectedCompany?.maxEmployees ?? 0}`}
                      valueStyle={{ color: '#1890ff', fontWeight: 700, fontSize: '28px' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={6}>
                  <Card bordered style={{ background: 'linear-gradient(135deg, rgba(250, 173, 20, 0.1) 0%, rgba(250, 173, 20, 0.05) 100%)' }}>
                    <Statistic
                      title="📋 排队任务"
                      value={capacityRes?.data?.data?.queued ?? 0}
                      suffix="个"
                      valueStyle={{ color: '#faad14', fontWeight: 700, fontSize: '28px' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} lg={6}>
                  <Card bordered>
                    <Statistic
                      title="运行中"
                      value={capacityRes?.data?.data?.running ?? 0}
                      suffix="个"
                    />
                  </Card>
                </Col>
              </Row>
              <Divider />
              <CompanyEmployeesCard companyId={selectedCompanyId} embedded />
            </Tabs.TabPane>
            <Tabs.TabPane tab="启动新项目" key="workflow">
              <Form
            form={form}
            layout="vertical"
            onFinish={handleRunWorkflow}
            initialValues={{
              executionMode: 'sequential',
              cloudProvider: 'aliyun',
            }}
          >
            <Alert
              message={<span style={{ color: '#FFD76E' }}>{`正在为公司「${selectedCompany?.name}」创建游戏项目`}</span>}
              description={<span style={{ color: '#d4c5a9' }}>填写项目信息后，将提交到生产线由您的AI员工团队开发</span>}
              type="info"
              showIcon
              style={{ 
                marginBottom: 16,
                background: 'rgba(40, 25, 15, 0.6)',
                border: '1px solid rgba(200, 140, 80, 0.3)'
              }}
            />
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="projectName"
                  label="🎯 项目名称"
                  rules={[{ required: true, message: '请输入项目名称' }]}
                >
                  <Input placeholder="例如：银河战纪" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="executionMode"
                  label="⚙️ 执行模式"
                  initialValue="sequential"
                  rules={[{ required: true }]}
                >
                  <Select options={executionModes} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item name="description" label="📝 游戏描述与工作流提示">
                  <Input.TextArea rows={4} placeholder="请在此填写游戏描述或工作流提示（将作为执行参数）" />
                </Form.Item>
              </Col>
            </Row>
            <Alert
              message={<span style={{ color: '#FFD76E' }}>💡 智能参数识别</span>}
              description={<span style={{ color: '#d4c5a9' }}>系统会根据您分配的策划、美术、技术等Agent的专业方向自动确定项目参数（游戏类型、维度、画风等）。如需调整Agent属性，请前往「员工Agent管理」页面。</span>}
              type="info"
              showIcon
              style={{ 
                marginBottom: 16,
                background: 'rgba(40, 25, 15, 0.6)',
                border: '1px solid rgba(200, 140, 80, 0.3)'
              }}
            />
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="cloudProvider"
                  label="☁️ 云存储服务"
                  initialValue="aliyun"
                  rules={[{ required: true }]}
                >
                  <Select
                    options={[
                      { label: '阿里云 OSS', value: 'aliyun' },
                      { label: 'Google Cloud', value: 'gcp' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label=" ">
                  <Button type="primary" htmlType="submit" block size="large">
                    🚀 提交到生产线
                  </Button>
                </Form.Item>
              </Col>
            </Row>
          </Form>
            </Tabs.TabPane>
          </Tabs>
        )}

        {/* 概念图上传模态框 */}
        {selectedCompanyId && (
          <ConceptImageUpload
            visible={conceptImageUploadVisible}
            companyId={selectedCompanyId}
            onClose={() => setConceptImageUploadVisible(false)}
            onSuccess={(imageUrl) => {
              message.success(`概念图上传成功: ${imageUrl}`)
            }}
          />
        )}
      </Card>

      <Card
        title="任务队列"
        extra={
          <Space>
            <Button size="small" loading={loadingQueue} onClick={fetchJobList}>
              同步队列
            </Button>
          </Space>
        }
      >
        {jobList.length === 0 ? (
          <Alert 
            message={<span style={{ color: '#FFD76E' }}>暂无运行中的任务</span>}
            description={<span style={{ color: '#d4c5a9' }}>提交后可在此查看进度</span>}
            type="info" 
            showIcon 
            style={{
              background: 'rgba(40, 25, 15, 0.6)',
              border: '1px solid rgba(200, 140, 80, 0.3)'
            }}
          />
        ) : (
          jobList.map((job) => (
            <Card
              key={job.jobId}
              type="inner"
              className="mb-4"
              title={
                <Space>
                  <Typography.Text strong>任务 {job.jobId}</Typography.Text>
                  <Tag
                    color={
                      job.status === 'completed'
                        ? 'green'
                        : job.status === 'running'
                        ? 'blue'
                        : job.status === 'clarifying'
                        ? 'orange'
                        : job.status === 'failed'
                        ? 'red'
                        : 'gold'
                    }
                  >
                    {job.status.toUpperCase()}
                  </Tag>
                </Space>
              }
              extra={
                <Space>
                  <Button size="small" onClick={() => refreshJob(job.jobId)}>
                    刷新
                  </Button>
                  {job.status === 'clarifying' && job.executionId && (
                    <Button size="small" type="primary" onClick={() => openClarificationModal(job)}>
                      补充细节
                    </Button>
                  )}
                  {job.executionId && (
                    <Tag color="purple">Execution: {job.executionId.slice(0, 8)}</Tag>
                  )}
                </Space>
              }
            >
              <Row gutter={16}>
                <Col xs={24} md={6}>
                  <Statistic
                    title="排队位置"
                    value={job.position}
                    suffix="位"
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
                <Col xs={24} md={6}>
                  <Statistic
                    title="预计开始"
                    value={formatEta(job.etaMs || 0)}
                  />
                </Col>
                <Col xs={24} md={6}>
                  <Statistic title="开始时间" value={job.startedAt || '--'} />
                </Col>
                <Col xs={24} md={6}>
                  <Statistic title="结束时间" value={job.finishedAt || '--'} />
                </Col>
              </Row>

              {job.stages && job.stages.length > 0 && (
                <>
                  <Divider />
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="stageId"
                    dataSource={job.stages}
                    columns={[
                      { title: '阶段', dataIndex: 'stageId' },
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (value: WorkflowStageStatus['status']) => {
                          const map: Record<string, string> = {
                            running: 'processing',
                            completed: 'success',
                            failed: 'error',
                            paused: 'warning',
                            pending: 'default',
                          }
                          return <Tag color={map[value] || 'default'}>{value.toUpperCase()}</Tag>
                        },
                      },
                      {
                        title: '操作',
                        render: (_, stage) =>
                          job.executionId ? (
                            <Space>
                              <Button
                                size="small"
                                disabled={stage.status === 'paused'}
                                onClick={() =>
                                  setControlModal({
                                    visible: true,
                                    action: 'pause',
                                    executionId: job.executionId!,
                                    stageId: stage.stageId,
                                    jobId: job.jobId,
                                  })
                                }
                              >
                                暂停
                              </Button>
                              <Button
                                size="small"
                                type="primary"
                                disabled={stage.status !== 'paused'}
                                onClick={() =>
                                  setControlModal({
                                    visible: true,
                                    action: 'resume',
                                    executionId: job.executionId!,
                                    stageId: stage.stageId,
                                    jobId: job.jobId,
                                  })
                                }
                              >
                                恢复
                              </Button>
                            </Space>
                          ) : (
                            '--'
                          ),
                      },
                    ]}
                  />
                </>
              )}

              {job.error && (
                <Alert className="mt-3" type="error" message={`错误: ${job.error}`} showIcon />
              )}
              {job.message && (
                <Alert className="mt-3" type="warning" message={`协调提示: ${job.message}`} showIcon />
              )}
            </Card>
          ))
        )}
      </Card>

      <Modal
        open={historyModalVisible}
        onCancel={closeHistoryModal}
        footer={null}
        title="已解散的公司"
        width={720}
      >
        {dissolvedCompanies.length === 0 ? (
          <Alert
            message={historyLoading ? '正在加载历史公司...' : '暂无已解散的公司'}
            type={historyLoading ? 'info' : 'warning'}
            showIcon
          />
        ) : (
          <Table
            size="small"
            loading={historyLoading}
            pagination={false}
            rowKey="id"
            dataSource={dissolvedCompanies}
            columns={[
              { title: '公司名称', dataIndex: 'name' },
              { title: '工作流模式', dataIndex: 'workflowType', render: (value: string) => value || '--' },
              { title: '初始资金', dataIndex: 'initialCapital', render: (value: number) => `${value} 币` },
              { title: '退还资金', dataIndex: 'currentCapital', render: (value: number) => `${value} 币` },
              {
                title: '解散时间',
                dataIndex: 'updatedAt',
                render: (value: string) => (value ? new Date(value).toLocaleString() : '--'),
              },
            ]}
          />
        )}
      </Modal>

      <StageControlModal
        state={controlModal}
        onSubmit={handleControlStage}
        onCancel={() => setControlModal((prev) => ({ ...prev, visible: false }))}
      />

      <Modal
        open={clarificationModal.visible}
        title="协调澄清"
        width={720}
        okText="提交回答"
        cancelText="关闭"
        onOk={handleClarificationSubmit}
        okButtonProps={{
          loading: clarLoading,
          disabled: pendingClarifications.length === 0,
        }}
        onCancel={closeClarificationModal}
      >
        {clarification ? (
          <>
            <List
              size="small"
              header={<Typography.Text strong>协作记录</Typography.Text>}
              dataSource={clarification.conversation.slice(-10)}
              locale={{ emptyText: '暂无记录' }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={`${item.role} · ${new Date(item.timestamp).toLocaleString()}${
                      item.stageId ? ` · ${item.stageId}` : ''
                    }`}
                    description={item.content}
                  />
                </List.Item>
              )}
            />
            <Divider />
            {pendingClarifications.length === 0 ? (
              <Alert message="暂无待回答的问题" type="success" showIcon />
            ) : (
              pendingClarifications.map((question) => (
                <Card key={question.questionId} size="small" className="mb-3" title={question.question}>
                  <Input.TextArea
                    rows={3}
                    placeholder="请输入具体细节，便于协调者将信息同步给各个Agent"
                    value={clarResponses[question.questionId] || ''}
                    onChange={(e) => handleClarificationInput(question.questionId, e.target.value)}
                  />
                </Card>
              ))
            )}
          </>
        ) : (
          <Alert message="正在加载澄清信息..." type="info" showIcon />
        )}
      </Modal>

      <Modal
        open={createCompanyModalVisible}
        title="🏢 创建游戏开发公司"
        okText={createMode === 'form' ? "✨ 立即创建" : "💬 发送"}
        okButtonProps={{
          loading: createMode === 'chat' ? conversationalLoading : false,
          disabled: createMode === 'chat' && !conversationalInput.trim()
        }}
        cancelText="取消"
        width={700}
        onOk={() => {
          if (createMode === 'form') {
            companyForm.submit()
          } else {
            handleConversationalSend()
          }
        }}
        onCancel={() => {
          setCreateCompanyModalVisible(false)
          setCreateMode('form')
          setConversationalMessages([])
          setConversationalInput('')
          setConversationalState({ phase: 'company', companyId: undefined, createdEmployees: [] })
          companyForm.resetFields()
        }}
      >
        <Tabs activeKey={createMode} onChange={(key) => setCreateMode(key as 'form' | 'chat')}>
          <Tabs.TabPane tab="📝 表单创建" key="form">
            <Form
              form={companyForm}
              layout="vertical"
              onFinish={handleCreateCompany}
              initialValues={{
                maxEmployees: 6,
                workflowType: 'linear',
                initialCapital: 1000,
              }}
            >
              <Form.Item
                name="name"
                label="公司名称"
                rules={[{ required: true, message: '请输入公司名称' }]}
              >
                <Input placeholder="例如：银河游戏工作室" />
              </Form.Item>
              <Form.Item name="description" label="公司简介">
                <Input.TextArea rows={3} placeholder="简要描述公司定位和目标" />
              </Form.Item>
              <Form.Item
                name="maxEmployees"
                label="员工数量"
                tooltip="一家游戏公司需要6位核心员工：策划、架构师、美术、研发、测试、音频"
              >
                <InputNumber disabled value={6} style={{ width: '100%' }} className="custom-input-number" />
              </Form.Item>
              <Form.Item
                name="workflowType"
                label="默认工作流模式"
                rules={[{ required: true, message: '请选择工作流模式' }]}
              >
                <Select
                  options={[
                    { label: '线性流程（顺序执行）', value: 'linear' },
                    { label: '反馈循环（迭代优化）', value: 'feedback' },
                    { label: '并发模式（并行开发）', value: 'concurrent' },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="initialCapital"
                label="初始资金（游戏币）"
                rules={[{ required: true, message: '请输入初始资金' }]}
                tooltip="将从您的个人账户扣除"
              >
                <InputNumber min={100} max={100000} style={{ width: '100%' }} placeholder="1000" className="custom-input-number" />
              </Form.Item>
            </Form>
          </Tabs.TabPane>
          <Tabs.TabPane tab="💬 对话创建" key="chat">
            <div style={{ marginBottom: 16 }}>
              <Alert
                message={<span style={{ color: '#FFD76E' }}>智能对话助手</span>}
                description={
                  <div style={{ color: '#d4c5a9' }}>
                    通过对话，我将帮您创建公司并雇佣6位必需员工：
                    <br />
                    <Typography.Text style={{ color: '#e8c468', fontSize: '12px' }}>
                      ✅ 策划（Planner） · ✅ 架构师（Architect） · ✅ 美术（Artist）
                      <br />
                      ✅ 研发（Developer） · ✅ 测试（Tester） · ✅ 音频（Music）
                    </Typography.Text>
                    <br />
                    {conversationalState.createdEmployees && conversationalState.createdEmployees.length > 0 && (
                      <Typography.Text style={{ color: '#90EE90', fontSize: '12px' }}>
                        已创建: {conversationalState.createdEmployees.join('、')} ({conversationalState.createdEmployees.length}/6)
                      </Typography.Text>
                    )}
                  </div>
                }
                type="info"
                showIcon
                style={{ 
                  background: 'rgba(40, 25, 15, 0.6)',
                  border: '1px solid rgba(200, 140, 80, 0.3)'
                }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <Space>
                <Typography.Text style={{ color: '#d4af37', fontWeight: 600 }}>🤖 AI模型:</Typography.Text>
                <Select
                  value={conversationalModel}
                  style={{ width: 200 }}
                  options={[
                    { label: 'GPT-4o（推荐）', value: 'gpt-4o' },
                    { label: 'GPT-5', value: 'gpt-5' },
                    { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4.5' },
                    { label: 'DeepSeek Reasoner', value: 'deepseek-reasoner' },
                  ]}
                  onChange={setConversationalModel}
                />
              </Space>
            </div>
            <div style={{ 
              height: '400px', 
              overflowY: 'auto', 
              border: '1px solid rgba(200, 140, 80, 0.3)', 
              borderRadius: '4px', 
              padding: '12px',
              marginBottom: '12px',
              background: 'rgba(40, 25, 15, 0.3)'
            }}>
              {conversationalMessages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: '#c8a060' }}>
                  <Typography.Text style={{ fontSize: '16px' }}>👋 你好！我是创建助手</Typography.Text><br/>
                  <Typography.Text style={{ fontSize: '14px', color: '#d4c5a9' }}>请告诉我您想创建什么样的公司？</Typography.Text>
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
                      <Typography.Text style={{ color: msg.role === 'user' ? '#FFD76E' : '#e8c468', fontSize: '12px' }}>
                        {msg.role === 'user' ? '👤 您' : '🤖 助手'}
                      </Typography.Text>
                      <div style={{ marginTop: '4px', color: '#f5e6d3', whiteSpace: 'pre-wrap' }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {conversationalLoading && (
                <div style={{ textAlign: 'center', color: '#c8a060' }}>
                  <Typography.Text>🤔 思考中...</Typography.Text>
                </div>
              )}
            </div>
            <Input.TextArea
              rows={3}
              value={conversationalInput}
              onChange={(e) => setConversationalInput(e.target.value)}
              placeholder="输入您的想法，按Enter或点击下方按钮发送，Shift+Enter换行..."
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault()
                  if (!conversationalLoading && conversationalInput.trim()) {
                    handleConversationalSend()
                  }
                }
              }}
              disabled={conversationalLoading}
            />
          </Tabs.TabPane>
        </Tabs>
      </Modal>

      <Modal
        open={executeModalVisible}
        title="🎬 执行工作流"
        okText="立即执行"
        cancelText="稍后再说"
        onOk={async () => {
          if (!executeCompanyId) return
          try {
            setExecuteModalLoading(true)
            const res = await apiClient.post<{
              success: boolean
              jobId?: string
              position?: number
              etaMs?: number
            }>(`/companies/${executeCompanyId}/execute`, {
              project: {
                projectName: `自动项目 - ${executeCompanyId}`,
                additionalRequirements: executePrompt,
              },
              executionMode: 'sequential',
              cloudProvider: 'aliyun',
            })

            if (!res.success) {
              message.error('自动执行失败')
              return
            }

            const jobState: WorkflowJobState = {
              jobId: res.jobId || 'unknown',
              status: 'queued',
              position: res.position || 0,
              etaMs: res.etaMs || 0,
            }

            setJobs((prev) => ({ ...prev, [jobState.jobId]: jobState }))
            message.success('工作流已进入队列')
            setExecuteModalVisible(false)
            setCreateCompanyModalVisible(false)
            setCreateMode('form')
            setConversationalMessages([])
            setConversationalInput('')
            setConversationalState({ phase: 'company', companyId: undefined, createdEmployees: [] })
            refetchCompanies?.()
          } catch (err: any) {
            console.error('执行失败', err)
            message.error(err?.response?.data?.message || '执行失败')
          } finally {
            setExecuteModalLoading(false)
          }
        }}
        onCancel={() => {
          setExecuteModalVisible(false)
          // 关闭对话并刷新公司列表
          setCreateCompanyModalVisible(false)
          setCreateMode('form')
          setConversationalMessages([])
          setConversationalInput('')
          setConversationalState({ phase: 'company', companyId: undefined, createdEmployees: [] })
          refetchCompanies?.()
        }}
        okButtonProps={{ loading: executeModalLoading }}
      >
        <Alert
          message="是否现在执行工作流？"
          description="您可以在下方修改或补充项目描述，系统会使用该信息作为工作流的附加要求。"
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea rows={6} value={executePrompt} onChange={(e) => setExecutePrompt(e.target.value)} />
      </Modal>

      <Modal
        open={fundModalVisible}
        title="向公司注资"
        okText="确认注资"
        cancelText="取消"
        onOk={() => fundForm.submit()}
        onCancel={() => {
          setFundModalVisible(false)
          fundForm.resetFields()
        }}
      >
        <Alert
          message="从个人账户向公司账户转账"
          description={`公司当前资金：${
            companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId)?.currentCapital ?? 0
          } 游戏币`}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={fundForm} layout="vertical" onFinish={handleInjectFunds}>
          <Form.Item
            name="amount"
            label="注资金额（游戏币）"
            rules={[
              { required: true, message: '请输入注资金额' },
              { type: 'number', min: 1, message: '金额必须大于0' },
            ]}
          >
            <Input type="number" min={1} placeholder="请输入要注入的金额" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Companies