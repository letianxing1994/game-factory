import React, { useState, useRef, useEffect } from 'react';
import { Modal, Select, Button, List, Input, message, Spin } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import { apiClient } from '../services/api';

const { TextArea } = Input;

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
}

interface ConversationalCompanyCreatorProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (companyId: number) => void;
}

const MODEL_OPTIONS = [
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  { label: 'DeepSeek Chat', value: 'deepseek-chat' },
  { label: 'Gemini Pro', value: 'gemini-pro' },
];

export const ConversationalCompanyCreator: React.FC<ConversationalCompanyCreatorProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = React.useState<'company' | 'employees' | 'completed'>('company');
  const [companyId, setCompanyId] = React.useState<number | null>(null);
  const [createdEmployees, setCreatedEmployees] = React.useState<string[]>([]);

  useEffect(() => {
    if (visible && messages.length === 0) {
      // 初始化对话
      setMessages([
        {
          role: 'assistant',
          content:
            '您好！我是游戏公司创建助手。我将帮助您创建一个完整的游戏公司（包括公司和6位必需员工）。\n\n首先，请告诉我公司的信息：\n1. 公司名称\n2. 公司简介（可选）\n3. 最大员工数（建议至少6人）\n4. 工作流程类型（linear 瀑布流 / feedback 反馈循环 / concurrent 敏捷并行）\n5. 初始资金（100-100000游戏币）\n\n您可以一次性告诉我，或者我们一步步来。',
        },
      ]);
    }
  }, [visible]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!userInput.trim()) return;

    const newUserMessage: Message = { role: 'user', content: userInput };
    setMessages((prev) => [...prev, newUserMessage]);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await apiClient.post('/companies/conversational-create', {
        model: selectedModel,
        messages: [...messages, newUserMessage],
        phase,
        companyId,
        createdEmployees,
      }) as {
        reply?: string;
        functionCall?: { name: string; arguments: string };
        companyId?: number;
        phase?: 'company' | 'employees' | 'completed';
        createdEmployees?: string[];
        remaining?: string[];
      };

      const { reply, functionCall, companyId: newCompanyId, phase: newPhase, createdEmployees: updatedEmployees } = response;

      if (reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      }

      if (functionCall) {
        // 显示函数调用信息（简化显示）
        const args = JSON.parse(functionCall.arguments);
        const summary = newPhase === 'employees' 
          ? `✅ 正在雇佣员工：${args.name}（${args.type}）...`
          : `✅ 正在创建公司：${args.name}...`;
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: summary,
            functionCall,
          },
        ]);
      }

      // 更新状态
      if (newCompanyId) {
        setCompanyId(newCompanyId);
      }
      if (newPhase) {
        setPhase(newPhase);
      }
      if (updatedEmployees) {
        setCreatedEmployees(updatedEmployees);
      }

      // 如果完成，通知父组件
      if (newPhase === 'completed' && newCompanyId) {
        message.success('公司及所有员工创建完成！');
        setTimeout(() => {
          onSuccess(newCompanyId);
          handleReset();
        }, 2000);
      }
    } catch (error: any) {
      console.error('对话式创建失败:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ 错误: ${error?.response?.data?.message || '创建失败，请重试'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setUserInput('');
    setPhase('company');
    setCompanyId(null);
    setCreatedEmployees([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      title="对话式创建公司"
      open={visible}
      onCancel={handleClose}
      width={700}
      footer={null}
    >
      <div style={{ marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>选择大模型：</span>
        <Select
          value={selectedModel}
          onChange={setSelectedModel}
          options={MODEL_OPTIONS}
          style={{ width: 200 }}
          disabled={isLoading}
        />
      </div>

      <div
        style={{
          height: 400,
          overflowY: 'auto',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          padding: 16,
          marginBottom: 16,
          backgroundColor: '#fafafa',
        }}
      >
        <List
          dataSource={messages}
          renderItem={(msg) => (
            <List.Item
              style={{
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                border: 'none',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  backgroundColor: msg.role === 'user' ? '#1890ff' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#000',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ marginBottom: 4 }}>
                  {msg.role === 'user' ? (
                    <UserOutlined style={{ marginRight: 4 }} />
                  ) : (
                    <RobotOutlined style={{ marginRight: 4 }} />
                  )}
                  <strong>{msg.role === 'user' ? '您' : 'AI助手'}</strong>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
              </div>
            </List.Item>
          )}
        />
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <TextArea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="输入消息...（Enter发送，Shift+Enter换行）"
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={isLoading}
        />
        <Button
          type="primary"
          icon={isLoading ? <Spin size="small" /> : <SendOutlined />}
          onClick={handleSend}
          disabled={isLoading || !userInput.trim()}
        >
          发送
        </Button>
      </div>
    </Modal>
  );
};
