# 💬 对话创建功能实现文档

> **状态**: ✅ 功能完整实现并同步到 game-factory-be (Go版本)

## 📋 功能概述

对话式创建允许用户通过自然语言与AI交互，快速创建公司和员工，无需手动填写复杂的表单。支持流式输出，实时显示AI回复。

## 🎯 核心特性

### 1. TypeScript后端 (game-factory/backend)

#### conversationalService.ts
- ✅ `processCompanyCreationStream` - 公司创建流式处理
- ✅ `processAgentCreationStream` - 员工创建流式处理  
- ✅ `processOpenAIStyleChatStream` - OpenAI/DeepSeek流式输出
- ✅ `processAnthropicChatStream` - Claude流式输出
- ✅ AsyncGenerator实现token级流式返回

#### routes/companies.ts & routes/agents.ts
- ✅ `POST /companies/conversational` - 公司创建SSE端点
- ✅ `POST /agents/conversational` - 员工创建SSE端点
- ✅ SSE（Server-Sent Events）流式响应
- ✅ Function Calling自动执行创建操作
- ✅ 多模型支持（gpt-4o, gpt-5, claude-sonnet-4.5, deepseek-r1）
- ✅ 完整事务处理和余额验证

### 2. Go后端 (game-factory-be)

#### internal/services/conversational_service.go
- ✅ `ProcessCompanyCreationStream` - 公司创建流式处理
- ✅ `ProcessAgentCreationStream` - 员工创建流式处理
- ✅ Channel-based streaming (Go惯用方式)
- ✅ OpenAI/DeepSeek客户端支持

#### internal/handlers/companies.go & agents.go
- ✅ `ConversationalCreateCompany` - SSE流式端点
- ✅ `ConversationalCreateAgent` - SSE流式端点
- ✅ GORM事务处理
- ✅ 数据库完整性验证

#### internal/routes/routes.go
- ✅ `POST /api/companies/conversational`
- ✅ `POST /api/agents/conversational`

### 3. 前端实现 (game-factory/frontend)

#### Companies.tsx
- ✅ 添加 `conversationalModel` 状态管理选择的AI模型
- ✅ 添加 `handleConversationalSend` 函数处理SSE流式接收
- ✅ 实时显示AI回复（逐字显示）
- ✅ 支持Enter键直接发送，Shift+Enter换行
- ✅ 添加发送按钮（带loading状态）
- ✅ 完整的错误处理和用户提示
- ✅ 创建成功后自动刷新页面

#### Agents.tsx
- ✅ 添加 `conversationalModel` 状态管理
- ✅ 添加 `handleConversationalAgentSend` 函数
- ✅ 实时显示AI回复（逐字显示）
- ✅ 支持Enter键发送
- ✅ 添加发送按钮
- ✅ 创建成功后自动刷新员工列表

### 3. 流式输出机制

#### 后端SSE格式
```
data: {"type":"token","content":"您"}
data: {"type":"token","content":"好"}
data: {"type":"token","content":"！"}
data: {"type":"success","content":"✅ 员工创建成功！","agentId":123}
data: [DONE]
```

#### 消息类型
- `token` - 单个文本token（用于流式显示）
- `message` - 完整消息（对话回复）
- `success` - 操作成功（返回companyId或agentId）
- `error` - 错误消息
- `[DONE]` - 流结束标记

#### 前端解析
- 使用 `fetch` API + `ReadableStream` 接收流
- 使用 `TextDecoder` 解码
- 逐行解析 `data:` 前缀的JSON数据
- 实时更新conversationalMessages状态
- 逐字累加显示AI回复

### 4. AI模型支持

#### 已集成模型
1. **GPT-4o** (推荐)
   - Provider: OpenAI
   - 支持Function Calling
   - 支持流式输出

2. **GPT-5**
   - Provider: OpenAI
   - 最新模型
   - 支持Function Calling

3. **Claude Sonnet 4.5**
   - Provider: Anthropic
   - 支持Tool Use（类似Function Calling）
   - 支持流式输出

4. **DeepSeek R1**
   - Provider: DeepSeek
   - OpenAI兼容API
   - 支持Function Calling

#### 模型路由逻辑
- 根据model参数自动选择对应的客户端
- OpenAI和DeepSeek使用统一的处理逻辑
- Claude使用Anthropic SDK
- 统一的AsyncGenerator接口

### 5. Function Calling

#### 公司创建函数
```typescript
{
  name: 'create_company',
  parameters: {
    name: string,           // 公司名称
    description: string,    // 公司简介
    maxEmployees: number,   // 最大员工数
    workflowType: 'linear' | 'feedback' | 'concurrent',
    initialCapital: number  // 初始资金
  }
}
```

#### 员工创建函数
```typescript
{
  name: 'create_agent',
  parameters: {
    name: string,           // 员工姓名
    type: string,           // 员工类型
    dimension: '2d' | '3d', // 维度
    specialization: string, // 专长领域
    ai_model: string,       // AI模型
    extra_traits: string    // 额外特点
  }
}
```

### 6. 用户体验

#### 交互优化
- ✅ 流式输出提供打字机效果
- ✅ Enter键快速发送
- ✅ Shift+Enter换行
- ✅ 发送按钮实时disabled状态
- ✅ Loading动画
- ✅ 成功提示音效（通过message组件）
- ✅ 错误友好提示
- ✅ 自动滚动到最新消息

#### 状态管理
- ✅ conversationalMessages - 对话历史
- ✅ conversationalInput - 输入内容
- ✅ conversationalLoading - 加载状态
- ✅ conversationalModel - 选择的AI模型
- ✅ conversationalState - 对话状态（phase, companyId等）

## 🚀 使用方式

### 创建公司
1. 点击"创建公司"按钮
2. 切换到"💬 对话创建"标签
3. 选择AI模型（默认GPT-4o）
4. 输入需求，例如："我想创建一个RPG游戏公司，员工上限50人"
5. 按Enter发送或点击发送按钮
6. AI会询问缺失的信息（初始资金等）
7. 回答后AI自动创建公司

### 创建员工
1. 点击"创建员工"按钮
2. 切换到"💬 对话创建"标签
3. 选择AI模型
4. 选择要分配的公司
5. 输入需求，例如："雇佣一个擅长Unity的技术人员"
6. AI会收集必要信息后自动创建

## 🚀 测试方式

### 1. 启动服务

**TypeScript后端:**
```bash
cd backend
npm run dev
```

**Go后端:**
```bash
cd game-factory-be
go run cmd/api/main.go
```

**前端:**
```bash
cd frontend
npm run dev
```

### 2. 使用流程

1. 点击"创建公司"或"创建员工"按钮
2. 切换到"💬 对话创建"标签
3. 选择AI模型（GPT-4o/GPT-5/Claude/DeepSeek）
4. 输入自然语言描述需求
5. 按Enter发送（Shift+Enter换行）
6. 观察流式输出和自动创建

### 3. 调试技巧

**浏览器DevTools:**
- Network → EventStream类型请求
- 查看实时SSE数据流

**后端日志:**
- TypeScript: `backend/logs/`
- Go: 控制台输出

## 📝 环境变量配置

```env
# 必需
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# 数据库
DB_HOST=localhost
DB_NAME=game_factory
DB_USER=root
DB_PASSWORD=your_password
```

## ❓ 常见问题

**Q: 没有流式输出？**  
A: 检查SSE响应头 (`Content-Type: text/event-stream`)

**Q: 模型选择不生效？**  
A: 确认API Key配置正确，检查网络请求中的model参数

**Q: Function Calling不执行？**  
A: 查看后端日志，确认tool_calls返回和参数完整性
