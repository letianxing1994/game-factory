import React, { useState } from 'react'
import {
  Alert,
  Button,
  Form,
  message,
  Modal,
  Progress,
  Select,
  Space,
  Upload,
  type UploadFile,
} from 'antd'
import {
  CloudUploadOutlined,
  InboxOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import type { RcFile } from 'antd/es/upload'
import { api } from '../services/api'

const { Dragger } = Upload

interface ConceptImageUploadProps {
  visible: boolean
  companyId?: number
  gameId?: number
  onClose: () => void
  onSuccess?: (imageUrl: string, category: string) => void
}

export const ConceptImageUpload: React.FC<ConceptImageUploadProps> = ({
  visible,
  companyId,
  gameId,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm()
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // 处理文件上传
  const handleUpload = async (values: any) => {
    if (fileList.length === 0) {
      message.warning('请先选择图片文件')
      return
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      const file = fileList[0].originFileObj as RcFile

      // 构建表单数据
      const formData = new FormData()
      formData.append('file', file)

      if (companyId) {
        formData.append('company_id', companyId.toString())
      }

      if (gameId) {
        formData.append('game_id', gameId.toString())
      }

      if (values.category) {
        formData.append('category', values.category)
      }

      // 上传文件到新的概念图接口
      const { data: res } = await api.post<{
        success: boolean
        data: {
          url: string
          filename: string
          size: number
          uploadedAt: string
        }
        message: string
      }>('/upload/concept-image', formData, {
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
        message.success('概念图上传成功！')
        form.resetFields()
        setFileList([])
        setUploadProgress(0)

        if (onSuccess && res.data?.url) {
          onSuccess(res.data.url, values.category || 'general')
        }

        onClose()
      } else {
        message.error(res.message || '上传失败')
      }
    } catch (error: any) {
      console.error('Upload error:', error)
      message.error(error?.response?.data?.message || '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  // 文件上传前的验证
  const beforeUpload = (file: RcFile) => {
    // 验证文件类型
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      message.error('只能上传图片文件！')
      return Upload.LIST_IGNORE
    }

    // 验证文件大小（最大 10MB）
    const isLt10M = file.size / 1024 / 1024 < 10
    if (!isLt10M) {
      message.error('图片大小不能超过 10MB！')
      return Upload.LIST_IGNORE
    }

    return false // 阻止自动上传
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
      title={<Space><PictureOutlined />上传游戏概念图</Space>}
      open={visible}
      onCancel={() => {
        setFileList([])
        setUploadProgress(0)
        form.resetFields()
        onClose()
      }}
      width={600}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleUpload}
        initialValues={{
          category: 'general',
        }}
      >
        <Alert
          message="提示"
          description="上传的概念图将用于游戏设计和开发过程中的参考。支持 JPG、PNG、GIF、WEBP 格式，最大 10MB。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item
          label="图片类别"
          name="category"
          tooltip="选择概念图的类别，便于分类管理"
        >
          <Select>
            <Select.Option value="general">通用概念图</Select.Option>
            <Select.Option value="character">角色设计</Select.Option>
            <Select.Option value="environment">场景环境</Select.Option>
            <Select.Option value="ui">UI界面</Select.Option>
            <Select.Option value="prop">道具物品</Select.Option>
            <Select.Option value="effect">特效动画</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="选择图片文件" required>
          <Dragger
            fileList={fileList}
            onChange={handleFileChange}
            beforeUpload={beforeUpload}
            maxCount={1}
            accept="image/*"
            showUploadList={{
              showRemoveIcon: true,
              showPreviewIcon: false,
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
            <p className="ant-upload-hint">
              支持 JPG、PNG、GIF、WEBP 格式，单个文件不超过 10MB
            </p>
          </Dragger>
        </Form.Item>

        {uploading && (
          <div style={{ marginBottom: 16 }}>
            <Progress percent={uploadProgress} status="active" />
          </div>
        )}

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button
              onClick={() => {
                setFileList([])
                setUploadProgress(0)
                form.resetFields()
                onClose()
              }}
            >
              取消
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={uploading}
              icon={<CloudUploadOutlined />}
              disabled={fileList.length === 0}
            >
              上传
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}
