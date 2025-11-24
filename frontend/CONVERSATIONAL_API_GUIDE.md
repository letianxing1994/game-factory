# 对话创建API集成指南

## 前端已完成的修改

### 1. 状态管理
- 添加了 `conversationalModel` 状态来保存用户选择的AI模型
- 默认值为 `'gpt-4o'`

### 2. UI改进
- ✅ 添加了AI模型选择器（Companies和Agents页面）
- ✅ 支持按Enter键发送消息，Shift+Enter换行
- ✅ 添加了发送按钮，显示在输入框右侧
- ✅ 模型选择会实时保存到状态中

### 3. 可选模型
- GPT-4o（推荐）
- GPT-5
- Claude Sonnet 4.5
- DeepSeek R1

## 后端需要实现的API

### 对话创建公司 API
**端点**: `POST /companies/conversational`

**请求体**:
```json
{
  "message": "用户输入的消息",
  "model": "gpt-4o",  // 用户选择的AI模型
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "state": {
    "phase": "collecting_info",  // 或 "creating_company"
    "companyId": 123,  // 如果已创建
    "createdEmployees": ["employee1", "employee2"]
  }
}
```

**响应**:
```json
{
  "success": true,
  "message": "AI助手的回复",
  "state": {
    "phase": "creating_company",
    "companyId": 123,
    "createdEmployees": []
  },
  "companyId": 123,  // 如果创建成功
  "agentId": 456  // 如果创建了员工
}
```

### 对话创建员工 API
**端点**: `POST /agents/conversational`

**请求体**:
```json
{
  "message": "用户输入的消息",
  "model": "deepseek-r1",  // 用户选择的AI模型
  "companyId": 123,  // 要分配到的公司ID
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "message": "AI助手的回复",
  "agentId": 789,  // 如果创建成功
  "agent": {
    "id": 789,
    "name": "张三",
    "type": "developer",
    "ai_model": "gpt-5"
  }
}
```

## 后端模型路由逻辑

根据 `model` 参数选择对应的AI服务：

```typescript
const modelConfigs = {
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY
  },
  'gpt-5': {
    provider: 'openai',
    model: 'gpt-5',
    apiKey: process.env.OPENAI_API_KEY
  },
  'claude-sonnet-4.5': {
    provider: 'anthropic',
    model: 'claude-sonnet-4.5',
    apiKey: process.env.ANTHROPIC_API_KEY
  },
  'deepseek-r1': {
    provider: 'deepseek',
    model: 'deepseek-r1',
    apiKey: process.env.DEEPSEEK_API_KEY
  }
}

function getAIClient(modelName: string) {
  const config = modelConfigs[modelName] || modelConfigs['gpt-4o']
  // 根据provider返回对应的AI客户端
  switch(config.provider) {
    case 'openai': return new OpenAIClient(config)
    case 'anthropic': return new AnthropicClient(config)
    case 'deepseek': return new DeepSeekClient(config)
  }
}
```

## 前端调用示例（待实现）

```typescript
const handleConversationalSend = async () => {
  if (!conversationalInput.trim()) return
  
  setConversationalLoading(true)
  const newMessages = [
    ...conversationalMessages,
    { role: 'user' as const, content: conversationalInput }
  ]
  setConversationalMessages(newMessages)
  setConversationalInput('')
  
  try {
    const res = await apiClient.post('/companies/conversational', {
      message: conversationalInput,
      model: conversationalModel,  // 使用选择的模型
      conversationHistory: conversationalMessages,
      state: conversationalState
    })
    
    if (res.success) {
      setConversationalMessages([
        ...newMessages,
        { role: 'assistant', content: res.message }
      ])
      
      if (res.state) {
        setConversationalState(res.state)
      }
      
      if (res.companyId) {
        message.success('🎉 公司创建成功！')
        // 刷新列表等
      }
    }
  } catch (error: any) {
    message.error(error?.response?.data?.message || '对话失败')
  } finally {
    setConversationalLoading(false)
  }
}
```

## 注意事项

1. **模型验证**: 后端应验证传入的model参数是否合法
2. **API密钥**: 确保对应的API密钥已配置在环境变量中
3. **错误处理**: 如果某个模型不可用，应返回友好的错误消息
4. **上下文管理**: 保持对话上下文，支持多轮对话
5. **状态持久化**: 考虑将对话状态存储到数据库，支持断点续传
