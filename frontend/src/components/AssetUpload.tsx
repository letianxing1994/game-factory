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
  Tag,
  Tooltip,
  Upload,
  type UploadFile,
} from 'antd'
import {
  CloudUploadOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  SoundOutlined,
} from '@ant-design/icons'
import type { RcFile } from 'antd/es/upload'
import { api, apiClient } from '../services/api'

const { Dragger } = Upload
const { TextArea } = Input

// 资产类型定义
const assetTypes = [
  { label: '策划文档', value: 'planning_doc', icon: <FileTextOutlined />, maxSize: 10 },
  { label: '美术概念图', value: 'art_concept', icon: <FileImageOutlined />, maxSize: 50 },
  { label: '纹理贴图', value: 'art_texture', icon: <FileImageOutlined />, maxSize: 20 },
  { label: '3D模型', value: 'art_model', icon: <FolderOpenOutlined />, maxSize: 100 },
  { label: '动画文件', value: 'art_animation', icon: <FolderOpenOutlined />, maxSize: 100 },
  { label: '背景音乐', value: 'audio_music', icon: <SoundOutlined />, maxSize: 50 },
  { label: '音效', value: 'audio_sfx', icon: <SoundOutlined />, maxSize: 10 },
  { label: '源代码', value: 'code_source', icon: <FileTextOutlined />, maxSize: 5 },
  { label: '资源包', value: 'code_asset', icon: <FolderOpenOutlined />, maxSize: 200 },
]

// 文件大小阈值（MB），超过此大小建议先上传到云端
const CLOUD_UPLOAD_THRESHOLD = 50

interface AssetUploadModalProps {
  visible: boolean
  projectId: string
  agentType?: string
  onCancel: () => void
  onSuccess: () => void
}

interface UploadedAsset {
  assetId: string
  fileName: string
  assetType: string
  fileSize: number
  localPath?: string
  cloudUrl?: string
  description?: string
  tags: string[]
}

export const AssetUploadModal: React.FC<AssetUploadModalProps> = ({
  visible,
  projectId,
  onCancel,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [cloudUploadMode, setCloudUploadMode] = useState(false)
  const [currentAssetType, setCurrentAssetType] = useState<string>()

  const selectedAssetTypeInfo = assetTypes.find((t) => t.value === currentAssetType)

  // 检查文件大小是否需要云端上传
  const checkFileSize = (file: RcFile) => {
    const sizeMB = file.size / 1024 / 1024
    if (sizeMB > CLOUD_UPLOAD_THRESHOLD) {
      Modal.confirm({
        title: '文件较大',
        content: `文件大小为 ${sizeMB.toFixed(2)} MB，建议先上传到云端存储。是否继续使用云端上传模式？`,
        onOk: () => {
          setCloudUploadMode(true)
        },
        onCancel: () => {
          setCloudUploadMode(false)
        },
      })
      return false // 阻止默认上传行为
    }
    return false // 阻止默认上传，手动控制
  }

  // 处理文件上传
  const handleUpload = async (values: any) => {
    if (fileList.length === 0) {
      message.warning('请先选择文件')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const file = fileList[0].originFileObj as RcFile
      const sizeMB = file.size / 1024 / 1024

      // 构建表单数据
      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId)
      formData.append('assetType', values.assetType)
      formData.append('description', values.description || '')
      formData.append('tags', JSON.stringify(values.tags || []))
      formData.append('cloudProvider', values.cloudProvider || 'aliyun')

      // 如果文件大，使用分片上传
      if (cloudUploadMode || sizeMB > CLOUD_UPLOAD_THRESHOLD) {
        formData.append('useMultipart', 'true')
      }

      // 上传文件（使用原始 api 实例以支持 onUploadProgress）
      const { data: res } = await api.post<{
        success: boolean
        data: UploadedAsset
      }>('/user-assets/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          const progress = progressEvent.total
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0
          setUploadProgress(progress)
        },
      })

      if (res.success) {
        message.success('资产上传成功！')
        form.resetFields()
        setFileList([])
        setUploadProgress(0)
        setCloudUploadMode(false)
        onSuccess()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  // 文件列表变化
  const handleFileChange = (info: any) => {
    let newFileList = [...info.fileList]
    // 只保留最新上传的文件
    newFileList = newFileList.slice(-1)
    setFileList(newFileList)
  }

  return (
    <Modal
      title="上传资产"
      open={visible}
      onCancel={onCancel}
      width={700}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleUpload}
        initialValues={{
          cloudProvider: 'aliyun',
          tags: [],
        }}
      >
        <Form.Item
          label="资产类型"
          name="assetType"
          rules={[{ required: true, message: '请选择资产类型' }]}
        >
          <Select
            placeholder="选择资产类型"
            onChange={(value) => setCurrentAssetType(value)}
            options={assetTypes.map((type) => ({
              label: (
                <Space>
                  {type.icon}
                  {type.label}
                  <Tag color="blue">{type.maxSize}MB</Tag>
                </Space>
              ),
              value: type.value,
            }))}
          />
        </Form.Item>

        {selectedAssetTypeInfo && (
          <Alert
            message={`文件大小限制：${selectedAssetTypeInfo.maxSize} MB 以内`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item label="选择文件" required>
          <Dragger
            fileList={fileList}
            onChange={handleFileChange}
            beforeUpload={checkFileSize}
            maxCount={1}
            showUploadList={{
              showRemoveIcon: true,
              showPreviewIcon: true,
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持单个文件上传。大文件会自动使用分片上传到云端。
            </p>
          </Dragger>
        </Form.Item>

        {cloudUploadMode && (
          <Alert
            message="云端上传模式"
            description="文件将先上传到云端对象存储，然后记录引用。这样可以更快地处理大文件，并在 workflow 运行时直接从云端获取。"
            type="warning"
            showIcon
            closable
            onClose={() => setCloudUploadMode(false)}
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item
          label="资产描述"
          name="description"
          rules={[{ required: true, message: '请输入资产描述' }]}
        >
          <TextArea
            rows={3}
            placeholder="描述这个资产的用途、特点等"
            maxLength={500}
            showCount
          />
        </Form.Item>

        <Form.Item label="标签" name="tags">
          <Select
            mode="tags"
            placeholder="添加标签（如：character, hero, texture 等）"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label="云存储提供商" name="cloudProvider">
          <Select>
            <Select.Option value="aliyun">阿里云 OSS</Select.Option>
            <Select.Option value="gcp">Google Cloud Storage</Select.Option>
          </Select>
        </Form.Item>

        {uploading && (
          <div style={{ marginBottom: 16 }}>
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}

        <Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>取消</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={uploading}
              icon={<CloudUploadOutlined />}
            >
              {cloudUploadMode ? '上传到云端' : '上传'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

// 资产列表组件
interface AssetListProps {
  projectId: string
  agentType?: string
}

export const AssetList: React.FC<AssetListProps> = ({ projectId, agentType }) => {
  const [assets, setAssets] = useState<UploadedAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [previewAsset, setPreviewAsset] = useState<UploadedAsset | null>(null)

  // 加载资产列表
  const loadAssets = async () => {
    setLoading(true)
    try {
      const params: any = { projectId }
      if (agentType) {
        params.agentId = `${agentType}-agent`
      }

      const res = await apiClient.get<{
        success: boolean
        data: { assets: UploadedAsset[] }
      }>('/user-assets', params)

      if (res.success) {
        setAssets(res.data.assets)
      }
    } catch (error: any) {
      message.error('加载资产列表失败')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (projectId) {
      loadAssets()
    }
  }, [projectId, agentType])

  // 删除资产
  const handleDelete = async (assetId: string) => {
    try {
      const res = await apiClient.delete<{ success: boolean }>(`/user-assets/${assetId}`)
      if (res.success) {
        message.success('删除成功')
        loadAssets()
      }
    } catch (error: any) {
      message.error('删除失败')
    }
  }

  // 获取资产类型图标
  const getAssetIcon = (assetType: string) => {
    const type = assetTypes.find((t) => t.value === assetType)
    return type?.icon || <FileTextOutlined />
  }

  return (
    <div>
      <Row gutter={[16, 16]}>
        {assets.map((asset) => (
          <Col key={asset.assetId} xs={24} sm={12} md={8} lg={6}>
            <Card
              size="small"
              title={
                <Tooltip title={asset.fileName}>
                  <Space>
                    {getAssetIcon(asset.assetType)}
                    <span
                      style={{
                        maxWidth: 150,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {asset.fileName}
                    </span>
                  </Space>
                </Tooltip>
              }
              extra={
                <Space>
                  <Tooltip title="预览">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => setPreviewAsset(asset)}
                    />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        Modal.confirm({
                          title: '确认删除',
                          content: `确定要删除 ${asset.fileName} 吗？`,
                          onOk: () => handleDelete(asset.assetId),
                        })
                      }}
                    />
                  </Tooltip>
                </Space>
              }
            >
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Tag>{assetTypes.find((t) => t.value === asset.assetType)?.label}</Tag>
                  <Tag color="blue">{(asset.fileSize / 1024 / 1024).toFixed(2)} MB</Tag>
                </div>
                {asset.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#666',
                      maxHeight: 40,
                      overflow: 'hidden',
                    }}
                  >
                    {asset.description}
                  </div>
                )}
                <div>
                  {asset.tags.map((tag) => (
                    <Tag key={tag} color="default" style={{ marginBottom: 4 }}>
                      {tag}
                    </Tag>
                  ))}
                </div>
                {asset.cloudUrl && (
                  <Tag color="green" icon={<CloudUploadOutlined />}>
                    已同步云端
                  </Tag>
                )}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      {assets.length === 0 && !loading && (
        <Card style={{ textAlign: 'center', padding: 40 }}>
          <InboxOutlined style={{ fontSize: 48, color: '#ccc' }} />
          <p style={{ color: '#999', marginTop: 16 }}>暂无资产</p>
        </Card>
      )}

      {/* 预览模态框 */}
      <Modal
        title="资产预览"
        open={!!previewAsset}
        onCancel={() => setPreviewAsset(null)}
        footer={[
          <Button key="close" onClick={() => setPreviewAsset(null)}>
            关闭
          </Button>,
          previewAsset?.cloudUrl && (
            <Button
              key="download"
              type="primary"
              href={previewAsset.cloudUrl}
              target="_blank"
            >
              下载
            </Button>
          ),
        ]}
      >
        {previewAsset && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <strong>文件名：</strong>
              {previewAsset.fileName}
            </div>
            <div>
              <strong>类型：</strong>
              {assetTypes.find((t) => t.value === previewAsset.assetType)?.label}
            </div>
            <div>
              <strong>大小：</strong>
              {(previewAsset.fileSize / 1024 / 1024).toFixed(2)} MB
            </div>
            {previewAsset.description && (
              <div>
                <strong>描述：</strong>
                <br />
                {previewAsset.description}
              </div>
            )}
            {previewAsset.localPath && (
              <div>
                <strong>本地路径：</strong>
                <br />
                <code>{previewAsset.localPath}</code>
              </div>
            )}
            {previewAsset.cloudUrl && (
              <div>
                <strong>云端地址：</strong>
                <br />
                <a href={previewAsset.cloudUrl} target="_blank" rel="noreferrer">
                  {previewAsset.cloudUrl}
                </a>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  )
}
