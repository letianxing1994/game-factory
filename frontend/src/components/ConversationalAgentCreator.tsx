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

interface ConversationalAgentCreatorProps {
  visible: boolean;
  companyId: number;
  onClose: () => void;
  onSuccess: (agentId: number) => void;
}

const MODEL_OPTIONS = [
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
  { label: 'DeepSeek Chat', value: 'deepseek-chat' },
  { label: 'Gemini Pro', value: 'gemini-pro' },
];

export const ConversationalAgentCreator: React.FC<ConversationalAgentCreatorProps> = ({
  visible,
  companyId,
  onClose,
  onSuccess,
}) => {
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && messages.length === 0) {
      // 初始化对话
      setMessages([
        {
          role: 'assistant',
          content:
            '您好！我是游戏公司员工招聘助手。我将帮助您为公司雇佣一个新的 AI 员工。请告诉我：\n\n1. 员工姓名\n2. 员工类型（planner 策划 / architect 架构师 / artist 美术 / developer 研发 / tester 测试 / music 音频）\n3. 维度（2d / 3d）\n4. 专长领域（例如：RPG、MOBA、关卡设计等）\n5. 使用的 AI 模型（例如：gpt-4、claude-3-5-sonnet 等）\n6. 额外特点（可选）\n\n您可以一次性告诉我，或者我们一步步来。',
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
      const response = await apiClient.post(`/agents/conversational-create`, {
        companyId,
        model: selectedModel,
        messages: [...messages, newUserMessage],
      }) as {
        reply?: string;
        functionCall?: { name: string; arguments: string };
        agentId?: number;
      };

      const { reply, functionCall, agentId } = response;

      if (reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      }

      if (functionCall) {
        // 显示函数调用信息
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `✅ 正在雇佣员工...\n参数：${JSON.stringify(JSON.parse(functionCall.arguments), null, 2)}`,
            functionCall,
          },
        ]);
      }

      if (agentId) {
        message.success('员工雇佣成功！');
        onSuccess(agentId);
        handleReset();
      }
    } catch (error: any) {
      console.error('对话式雇佣失败:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `❌ 错误: ${error?.response?.data?.message || '雇佣失败，请重试'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setUserInput('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      title="对话式雇佣员工"
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
