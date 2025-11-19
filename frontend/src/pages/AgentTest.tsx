import React, { useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Typography,
} from 'antd'
import {
  PlayCircleOutlined,
  RobotOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { apiClient } from '../services/api'
import { AssetUploadModal } from '../components/AssetUpload'

const { Title, Paragraph } = Typography
const { TextArea } = Input

interface AgentConfig {
  agentId: string
  name: string
  type: string
  provider: string
  model: string
  systemPrompt: string
  supportedAssetTypes: string[]
}

interface AgentTestPageProps {
  // 可以从路由或父组件传入
}

export const AgentTestPage: React.FC<AgentTestPageProps> = () => {
  const [form] = Form.useForm()
  const [testing, setTesting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [testResult, setTestResult] = useState<any>(null)
  const [selectedAgent, setSelectedAgent] = useState<AgentConfig | null>(null)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [mcpConfigModalVisible, setMcpConfigModalVisible] = useState(false)

  // Agent 配置列表（从后端获取）
  const agentConfigs: AgentConfig[] = [
    {
      agentId: 'planning-agent',
      name: '策划 Agent',
      type: 'planning',
      provider: 'deepseek',
      model: 'deepseek-r1',
      systemPrompt: '你是一位资深的游戏策划专家...',
      supportedAssetTypes: ['planning_doc'],
    },
    {
      agentId: 'art-agent',
      name: '美术 Agent',
      type: 'art',
      provider: 'meshy',
      model: 'meshy-4',
      systemPrompt: '你是一位专业的游戏美术设计师...',
      supportedAssetTypes: ['art_concept', 'art_texture', 'art_model', 'art_animation'],
    },
    {
      agentId: 'music-agent',
      name: '音乐 Agent',
      type: 'music',
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: '你是一位专业的游戏音频设计师...',
      supportedAssetTypes: ['audio_music', 'audio_sfx'],
    },
    {
      agentId: 'tech-agent',
      name: '技术 Agent',
      type: 'tech',
      provider: 'anthropic',
      model: 'claude-sonnet-4.5',
      systemPrompt: '你是一位资深的游戏开发工程师...',
      supportedAssetTypes: ['code_source', 'code_asset'],
    },
    {
      agentId: 'test-agent',
      name: '测试 Agent',
      type: 'test',
      provider: 'anthropic',
      model: 'claude-sonnet-4.5',
      systemPrompt: '你是一位专业的游戏QA测试工程师...',
      supportedAssetTypes: [],
    },
  ]

  // 执行测试
  const handleTest = async (values: any) => {
    if (!selectedAgent) {
      message.warning('请先选择 Agent')
      return
    }

    setTesting(true)
    setProgress(0)
    setTestResult(null)

    try {
      // 构建测试请求
      const payload: any = {
        agentId: selectedAgent.agentId,
        userRequirement: values.requirement,
        modelConfig: {
          provider: values.provider || selectedAgent.provider,
          model: values.model || selectedAgent.model,
          systemPrompt: values.systemPrompt || selectedAgent.systemPrompt,
        },
        useUserAssets: values.useUserAssets || false,
        useMCPIntegration: values.useMCPIntegration || false,
        projectId: values.projectId || 'test-project',
      }

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 500)

      // 发送测试请求
      const res = await apiClient.post<{
        success: boolean
        data: any
      }>('/agents/test', payload)

      clearInterval(progressInterval)
      setProgress(100)

      if (res.success) {
        setTestResult(res.data)
        message.success('测试完成！')
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '测试失败')
    } finally {
      setTesting(false)
    }
  }

  // 渲染测试结果
  const renderTestResult = () => {
    if (!testResult) return null

    return (
      <Card title="测试结果" style={{ marginTop: 24 }}>
        <Tabs
          items={[
            {
              key: 'output',
              label: '生成内容',
              children: (
                <div>
                  {testResult.artifact && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <strong>Artifact ID:</strong> {testResult.artifact.artifactId}
                      </div>
                      <div>
                        <strong>类型:</strong> {testResult.artifact.type}
                      </div>
                      {testResult.artifact.url && (
                        <div>
                          <strong>资源地址:</strong>
                          <br />
                          <a
                            href={testResult.artifact.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {testResult.artifact.url}
                          </a>
                        </div>
                      )}
                      {testResult.artifact.content && (
                        <div>
                          <strong>内容:</strong>
                          <pre
                            style={{
                              background: '#f5f5f5',
                              padding: 16,
                              borderRadius: 4,
                              maxHeight: 400,
                              overflow: 'auto',
                            }}
                          >
                            {JSON.stringify(testResult.artifact.content, null, 2)}
                          </pre>
                        </div>
                      )}
                    </Space>
                  )}
                </div>
              ),
            },
            {
              key: 'metadata',
              label: '元数据',
              children: (
                <pre
                  style={{
                    background: '#f5f5f5',
                    padding: 16,
                    borderRadius: 4,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {JSON.stringify(testResult.metadata || {}, null, 2)}
                </pre>
              ),
            },
            {
              key: 'logs',
              label: '执行日志',
              children: (
                <div
                  style={{
                    background: '#000',
                    color: '#0f0',
                    padding: 16,
                    borderRadius: 4,
                    fontFamily: 'monospace',
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {testResult.logs?.map((log: string, index: number) => (
                    <div key={index}>{log}</div>
                  )) || '无日志'}
                </div>
              ),
            },
          ]}
        />
      </Card>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <RobotOutlined /> Agent 测试与预览
      </Title>
      <Paragraph type="secondary">
        单独测试 Agent 的能力，可以配置模型、上传素材、或关联本地工具（MCP）
      </Paragraph>

      <Row gutter={24}>
        {/* 左侧：Agent 选择和配置 */}
        <Col xs={24} lg={12}>
          <Card title="1. 选择 Agent" style={{ marginBottom: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {agentConfigs.map((agent) => (
                <Card
                  key={agent.agentId}
                  size="small"
                  hoverable
                  onClick={() => setSelectedAgent(agent)}
                  style={{
                    border:
                      selectedAgent?.agentId === agent.agentId
                        ? '2px solid #1890ff'
                        : '1px solid #d9d9d9',
                  }}
                >
                  <Space>
                    <RobotOutlined style={{ fontSize: 24 }} />
                    <div>
                      <div>
                        <strong>{agent.name}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {agent.provider} / {agent.model}
                      </div>
                    </div>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>

          {selectedAgent && (
            <>
              <Card title="2. 配置模型" style={{ marginBottom: 24 }}>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleTest}
                  initialValues={{
                    provider: selectedAgent.provider,
                    model: selectedAgent.model,
                    systemPrompt: selectedAgent.systemPrompt,
                  }}
                >
                  <Form.Item label="提供商" name="provider">
                    <Select>
                      <Select.Option value="deepseek">DeepSeek</Select.Option>
                      <Select.Option value="openai">OpenAI</Select.Option>
                      <Select.Option value="anthropic">Anthropic</Select.Option>
                      <Select.Option value="meshy">Meshy</Select.Option>
                      <Select.Option value="hunyuan3d">腾讯混元3D</Select.Option>
                    </Select>
                  </Form.Item>

                  <Form.Item label="模型" name="model">
                    <Input placeholder="如：deepseek-r1, gpt-4o, claude-sonnet-4.5" />
                  </Form.Item>

                  <Form.Item label="系统提示词" name="systemPrompt">
                    <TextArea
                      rows={4}
                      placeholder="自定义系统提示词（可选）"
                    />
                  </Form.Item>

                  <Form.Item label="测试需求" name="requirement" rules={[{ required: true }]}>
                    <TextArea
                      rows={4}
                      placeholder="输入你的测试需求，如：生成一个科幻风格的角色设计"
                    />
                  </Form.Item>

                  <Form.Item label="选项">
                    <Space direction="vertical">
                      <Form.Item name="useUserAssets" valuePropName="checked" noStyle>
                        <Button
                          icon={<UploadOutlined />}
                          onClick={() => setUploadModalVisible(true)}
                        >
                          使用用户素材
                        </Button>
                      </Form.Item>
                      <Form.Item name="useMCPIntegration" valuePropName="checked" noStyle>
                        <Button
                          icon={<SettingOutlined />}
                          onClick={() => setMcpConfigModalVisible(true)}
                        >
                          关联本地工具 (MCP)
                        </Button>
                      </Form.Item>
                    </Space>
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<PlayCircleOutlined />}
                      loading={testing}
                      size="large"
                      block
                    >
                      开始测试
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </>
          )}
        </Col>

        {/* 右侧：测试进度和结果 */}
        <Col xs={24} lg={12}>
          {testing && (
            <Card title="测试进行中..." style={{ marginBottom: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Progress percent={progress} status="active" />
                <Spin tip="Agent 正在处理您的请求..." />
                <Alert
                  message="请等待"
                  description="根据任务复杂度，可能需要几秒到几分钟不等"
                  type="info"
                />
              </Space>
            </Card>
          )}

          {renderTestResult()}

          {!testing && !testResult && (
            <Card>
              <div style={{ textAlign: 'center', padding: 40 }}>
                <RobotOutlined style={{ fontSize: 64, color: '#ccc' }} />
                <p style={{ color: '#999', marginTop: 16 }}>
                  选择 Agent 并配置后点击"开始测试"
                </p>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* 资产上传模态框 */}
      {selectedAgent && (
        <AssetUploadModal
          visible={uploadModalVisible}
          projectId="test-project"
          agentType={selectedAgent.type}
          onCancel={() => setUploadModalVisible(false)}
          onSuccess={() => {
            setUploadModalVisible(false)
            message.success('素材上传成功，可以在测试中使用')
          }}
        />
      )}

      {/* MCP 配置模态框 */}
      <Modal
        title="MCP 本地工具配置"
        open={mcpConfigModalVisible}
        onCancel={() => setMcpConfigModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setMcpConfigModalVisible(false)}>
            关闭
          </Button>,
          <Button key="save" type="primary">
            保存配置
          </Button>,
        ]}
      >
        <Alert
          message="MCP 集成"
          description="配置本地 DCC 工具（Blender、Maya、Photoshop）或游戏引擎（Unity、Unreal），Agent 可以调用本地工具生成资源。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form layout="vertical">
          <Form.Item label="工具类型">
            <Select placeholder="选择要关联的工具">
              <Select.Option value="blender">Blender</Select.Option>
              <Select.Option value="maya">Maya</Select.Option>
              <Select.Option value="photoshop">Photoshop</Select.Option>
              <Select.Option value="unity">Unity</Select.Option>
              <Select.Option value="unreal">Unreal Engine</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="工具路径">
            <Input placeholder="C:/Program Files/Blender/blender.exe" />
          </Form.Item>
          <Form.Item label="工作目录">
            <Input placeholder="./data/mcp/blender" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AgentTestPage
