import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from 'react-query'
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { apiClient } from '../services/api'
import type {
  ClarificationState,
  Company,
  GameGenreSelection,
  PlanningFocusConfig,
  WorkflowCapacity,
  WorkflowJobState,
  WorkflowStageStatus,
} from '../types'

const { Title, Text } = Typography

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const executionModes = [
  { label: '顺序', value: 'sequential' },
  { label: '异步并行', value: 'async_parallel' },
  { label: '反馈循环', value: 'feedback_loop' },
]

type ControlAction = 'pause' | 'resume'

interface StageControlState {
  visible: boolean
  action: ControlAction
  stageId: string
  executionId: string
  jobId: string
}

interface ClarificationModalState {
  visible: boolean
  executionId: string
  jobId: string
}

// 公司创建表单接口
interface CompanyFormValues {
  name: string
  description?: string
  maxEmployees: number
  workflowType: 'linear' | 'feedback' | 'concurrent'
  initialCapital: number
}

// 项目执行表单接口
interface WorkflowFormValues {
  projectName: string
  primaryGenre: string
  subGenre?: string
  hybridGenres?: string[]
  dimension: '2d' | '3d'
  artStyle: string
  gameMode: 'singleplayer' | 'multiplayer'
  description?: string
  executionMode: 'sequential' | 'async_parallel' | 'feedback_loop'
  cloudProvider: 'aliyun' | 'gcp'
  planningCapabilities?: string[]
  planningSystems?: string[]
}

const hasPlanningFocus = (focus?: PlanningFocusConfig) => {
  if (!focus) return false;
  if (focus.narrative || focus.numeric || focus.levelDesign) return true;
  if (focus.systemDesign) {
    return Object.values(focus.systemDesign).some(Boolean);
  }
  return false;
};

const buildPlanningFocus = (values: WorkflowFormValues): PlanningFocusConfig | undefined => {
  const focus: PlanningFocusConfig = {};
  const capabilities = values.planningCapabilities || [];
  if (capabilities.includes('narrative')) focus.narrative = true;
  if (capabilities.includes('numeric')) focus.numeric = true;
  if (capabilities.includes('level')) focus.levelDesign = true;

  const systems = values.planningSystems || [];
  if (systems.length) {
    focus.systemDesign = {
      growth: systems.includes('growth') || undefined,
      equipment: systems.includes('equipment') || undefined,
      social: systems.includes('social') || undefined,
      combat: systems.includes('combat') || undefined,
    };
  }

  return hasPlanningFocus(focus) ? focus : undefined;
};

const buildGenreSelection = (values: WorkflowFormValues): GameGenreSelection => {
  const hybrid =
    values.hybridGenres?.filter((genre) => genre && genre !== values.primaryGenre) || [];
  return {
    primary: values.primaryGenre as GameGenreSelection['primary'],
    subGenre: values.subGenre as GameGenreSelection['subGenre'],
    hybrid: hybrid.length ? (hybrid as GameGenreSelection['hybrid']) : undefined,
  };
};

const formatEta = (etaMs?: number) => {
  if (!etaMs || etaMs <= 0) return '排队中'
  const minutes = Math.floor(etaMs / 60000)
  const seconds = Math.floor((etaMs % 60000) / 1000)
  return `${minutes}分${seconds}秒`
}

const StageControlModal: React.FC<{
  state: StageControlState
  onSubmit: (notes?: string) => Promise<void>
  onCancel: () => void
}> = ({ state, onSubmit, onCancel }) => {
  const [notes, setNotes] = useState('')
  useEffect(() => {
    if (!state.visible) {
      setNotes('')
    }
  }, [state.visible])

  return (
    <Modal
      open={state.visible}
      title={state.action === 'pause' ? '暂停阶段' : '恢复阶段'}
      onOk={() => onSubmit(notes)}
      onCancel={onCancel}
      okText="确认"
      cancelText="取消"
    >
      <p className="mb-3 text-sm text-gray-600">
        阶段 <strong>{state.stageId}</strong> 将被
        {state.action === 'pause' ? '暂停' : '恢复'}。可以在下方备注原因或提示。
      </p>
      <Input.TextArea
        rows={4}
        value={notes}
        placeholder="备注或补充信息（可选）"
        onChange={(e) => setNotes(e.target.value)}
      />
    </Modal>
  )
}

interface CompanyEmployeesCardProps {
  companyId: number
}

const CompanyEmployeesCard: React.FC<CompanyEmployeesCardProps> = ({ companyId }) => {
  const { data: employeesRes, isLoading } = useQuery(
    ['company', companyId, 'employees'],
    async () => {
      const res = await apiClient.get<{ success: boolean; data: any[] }>(
        `/companies/${companyId}/employees`
      )
      return res
    },
    { enabled: !!companyId }
  )

  const employees = employeesRes?.data || []

  return (
    <Card title="公司员工" extra={<Text type="secondary">{employees.length} 名员工</Text>}>
      {isLoading ? (
        <Alert message="加载中..." type="info" showIcon />
      ) : employees.length === 0 ? (
        <Alert message="暂无员工，请前往员工市场招聘" type="warning" showIcon />
      ) : (
        <Table
          size="small"
          pagination={false}
          dataSource={employees}
          rowKey="id"
          columns={[
            {
              title: '员工ID',
              dataIndex: 'id',
              width: 80,
            },
            {
              title: '类型',
              dataIndex: 'type',
              width: 100,
              render: (type: string) => {
                const typeMap: Record<string, string> = {
                  planner: '策划',
                  artist: '美术',
                  developer: '技术',
                  tester: '测试',
                }
                return <Tag color="blue">{typeMap[type] || type}</Tag>
              },
            },
            {
              title: '维度',
              dataIndex: 'dimension',
              width: 80,
              render: (dimension: string) =>
                dimension ? <Tag color={dimension === '3d' ? 'purple' : 'cyan'}>{dimension.toUpperCase()}</Tag> : '--',
            },
            {
              title: 'AI模型',
              dataIndex: 'ai_model',
              ellipsis: true,
            },
            {
              title: '技能',
              dataIndex: 'skills',
              render: (skills: string | string[]) => {
                const skillArray = Array.isArray(skills) ? skills : JSON.parse(skills || '[]')
                return skillArray.slice(0, 3).map((skill: string) => (
                  <Tag key={skill} style={{ fontSize: '11px' }}>
                    {skill}
                  </Tag>
                ))
              },
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 80,
              render: (status: string) => (
                <Tag color={status === 'employed' ? 'green' : 'default'}>
                  {status === 'employed' ? '在职' : status}
                </Tag>
              ),
            },
          ]}
        />
      )}
    </Card>
  )
}

const Companies: React.FC = () => {
  const [form] = Form.useForm<WorkflowFormValues>()
  const [companyForm] = Form.useForm<CompanyFormValues>()
  const [fundForm] = Form.useForm<{ amount: number }>()
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>()
  const [jobs, setJobs] = useState<Record<string, WorkflowJobState>>({})
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [createCompanyModalVisible, setCreateCompanyModalVisible] = useState(false)
  const [fundModalVisible, setFundModalVisible] = useState(false)
  const [controlModal, setControlModal] = useState<StageControlState>({
    visible: false,
    action: 'pause',
    executionId: '',
    stageId: '',
    jobId: '',
  })
  const [clarificationModal, setClarificationModal] = useState<ClarificationModalState>({
    visible: false,
    executionId: '',
    jobId: '',
  })
  const [clarification, setClarification] = useState<ClarificationState | null>(null)
  const [clarResponses, setClarResponses] = useState<Record<string, string>>({})
  const [clarLoading, setClarLoading] = useState(false)
  const clarStreamController = useRef<AbortController | null>(null)

  const { data: companiesRes } = useQuery(['companies', 'mine'], async () => {
    const res = await apiClient.get<{ success: boolean; data: Company[] }>('/companies/my')
    return res
  })

  const { data: capacityRes } = useQuery(
    ['workflow', 'capacity'],
    async () => {
      const res = await apiClient.get<{ success: boolean; data: WorkflowCapacity }>(
        '/workflows/capacity'
      )
      return res
    },
    { refetchInterval: 15000 }
  )

  useEffect(() => {
    if (!selectedCompanyId && companiesRes?.success && companiesRes.data.length > 0) {
      setSelectedCompanyId(companiesRes.data[0].id)
    }
  }, [companiesRes, selectedCompanyId])

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
        maxEmployees: values.maxEmployees,
        workflowType: values.workflowType,
        initialCapital: values.initialCapital,
      })

      if (res.success) {
        message.success('公司创建成功')
        setCreateCompanyModalVisible(false)
        companyForm.resetFields()
        // 刷新公司列表
        window.location.reload()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '创建公司失败')
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
        window.location.reload()
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

  const companyOptions = useMemo(
    () =>
      companiesRes?.data?.map((company: Company) => ({
        label: company.name,
        value: company.id,
      })) || [],
    [companiesRes]
  )

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
        <Title level={3} className="!mb-0">
          公司工作流调度
        </Title>
        <Space>
          <Button type="primary" onClick={() => setCreateCompanyModalVisible(true)}>
            创建公司
          </Button>
          <Button
            type="default"
            disabled={!selectedCompanyId}
            onClick={() => setFundModalVisible(true)}
          >
            注资
          </Button>
          <Select
            value={selectedCompanyId}
            options={companyOptions}
            onChange={setSelectedCompanyId}
            placeholder="选择公司"
            style={{ minWidth: 220 }}
          />
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={4}>
          <Card bordered>
            <Statistic
              title="公司资金"
              value={companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId)?.currentCapital ?? 0}
              suffix="币"
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={4}>
          <Card bordered>
            <Statistic
              title="公司员工"
              value={companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId)?.currentEmployees ?? 0}
              suffix={`/ ${companiesRes?.data?.find((c: Company) => c.id === selectedCompanyId)?.maxEmployees ?? 0}`}
            />
          </Card>
        </Col>
        <Col xs={24} lg={5}>
          <Card bordered>
            <Statistic
              title="排队任务"
              value={capacityRes?.data?.queued ?? 0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} lg={5}>
          <Card bordered>
            <Statistic
              title="运行中"
              value={capacityRes?.data?.running ?? 0}
              suffix="个"
            />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card bordered>
            <Statistic
              title="平均耗时"
              value={Math.round((capacityRes?.data?.avgDurationMs ?? 0) / 60000)}
              suffix="分钟/Stage"
            />
          </Card>
        </Col>
      </Row>

      {selectedCompanyId && (
        <CompanyEmployeesCard companyId={selectedCompanyId} />
      )}

      <Card title="启动新游戏项目">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRunWorkflow}
          initialValues={{
            executionMode: 'sequential',
            primaryGenre: 'rpg',
            dimension: '3d',
            artStyle: 'realistic',
            gameMode: 'singleplayer',
            cloudProvider: 'aliyun',
            planningCapabilities: [],
            planningSystems: [],
            hybridGenres: [],
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="projectName"
                label="项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="例如：银河战纪" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="executionMode"
                label="执行模式"
                initialValue="sequential"
                rules={[{ required: true }]}
              >
                <Select options={executionModes} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item name="description" label="项目需求描述">
                <Input.TextArea rows={4} placeholder="描述您想要制作的游戏，例如：一款中世纪魔幻风格的RPG游戏，玩家扮演勇者拯救王国..." />
              </Form.Item>
            </Col>
          </Row>
          <Alert
            message="提示：游戏类型、维度、画风等设定已在Agent创建时定义"
            description="系统会根据您分配的策划、美术、技术等Agent的专业方向自动确定项目参数。如果需要调整，请在Agent管理页面修改Agent属性。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="cloudProvider"
                label="云服务商"
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
                <Button type="primary" htmlType="submit" block>
                  提交到生产线
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
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
          <Alert message="暂无运行中的任务，提交后可在此查看进度" type="info" showIcon />
        ) : (
          jobList.map((job) => (
            <Card
              key={job.jobId}
              type="inner"
              className="mb-4"
              title={
                <Space>
                  <Text strong>任务 {job.jobId}</Text>
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
                    value={formatEta(job.etaMs)}
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
              header={<Text strong>协作记录</Text>}
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
        title="创建公司"
        okText="创建"
        cancelText="取消"
        onOk={() => companyForm.submit()}
        onCancel={() => {
          setCreateCompanyModalVisible(false)
          companyForm.resetFields()
        }}
      >
        <Form
          form={companyForm}
          layout="vertical"
          onFinish={handleCreateCompany}
          initialValues={{
            maxEmployees: 10,
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
            label="最大员工数"
            rules={[{ required: true, message: '请输入最大员工数' }]}
          >
            <Input type="number" min={1} max={100} />
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
            <Input type="number" min={100} max={100000} />
          </Form.Item>
        </Form>
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