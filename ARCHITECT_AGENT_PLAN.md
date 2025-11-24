# 架构师 Agent 与对话式创建功能 - 技术方案

## 需求概述

### 1. 架构师 Agent
- 新增架构师角色，作为策划和研发的中间节点
- 为研发拆解任务，设定技术框架
- 为测试提供功能点文档
- 追踪美术、音频产物完善架构文档
- 适配三种工作流（agile/waterfall/hybrid）

### 2. 对话式创建功能
- 通过对话创建公司和 Agent
- 支持选择大模型（GPT/DeepSeek/Gemini）
- Function Calling 集成
- 保持 UI 风格一致

### 3. 侧边栏抽屉功能
- 左侧 Tab 可收缩/展开
- 保存用户偏好

---

## 实施计划

### 阶段 1: 类型定义与数据模型（1-2小时）

#### 1.1 前端类型更新
**文件**: `game-factory/frontend/src/types/index.ts`

```typescript
// 更新 EmployeeAgent 类型
export interface EmployeeAgent {
  // ... 现有字段
  type: 'planner' | 'architect' | 'artist' | 'developer' | 'tester' | 'operator' | 'music';
  // ...
}

// 新增对话创建相关类型
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ModelConfig {
  provider: 'openai' | 'deepseek' | 'gemini';
  model: string;
  apiKey?: string;
}

export interface FunctionCallResult {
  name: string;
  arguments: any;
  result?: any;
}
```

#### 1.2 后端类型更新
**文件**: 
- `game-factory/backend/src/middleware/validation.ts`
- `game-factory-be/internal/models/models.go`

```typescript
// validation.ts
type: Joi.string().valid('planner', 'architect', 'artist', 'developer', 'tester', 'operator', 'music').required()
```

```go
// models.go
const (
    AgentTypePlanner    = "planner"
    AgentTypeArchitect  = "architect"  // 新增
    AgentTypeArtist     = "artist"
    AgentTypeDeveloper  = "developer"
    AgentTypeTester     = "tester"
    AgentTypeOperator   = "operator"
    AgentTypeMusic      = "music"
)
```

---

### 阶段 2: 工作流集成（2-3小时）

#### 2.1 更新工作流构建器
**文件**: `game-factory/backend/src/services/workflowBuilder.ts`

```typescript
// 标准工作流阶段（添加架构师阶段）
const STANDARD_STAGES = [
  { stageId: 'planning', agentId: 'planning-agent', requiredType: 'planner' },
  { stageId: 'architecture', agentId: 'architect-agent', requiredType: 'architect' }, // 新增
  { stageId: 'art', agentId: 'art-agent', requiredType: 'artist' },
  { stageId: 'music', agentId: 'music-agent', requiredType: 'music' },
  { stageId: 'tech', agentId: 'tech-agent', requiredType: 'developer' },
  { stageId: 'testing', agentId: 'testing-agent', requiredType: 'tester' },
];

// 架构师阶段配置
function buildArchitectureStage(architect: Agent, gdd: any, artAssets?: any, musicAssets?: any) {
  return {
    stageId: 'architecture',
    agentId: architect.id,
    agentType: 'architect',
    mode: 'llm+kb',
    dependencies: ['planning'], // 依赖策划阶段
    inputs: {
      gdd,
      artAssets,   // 可选：美术产物
      musicAssets, // 可选：音频产物
    },
    prompt: `Based on the GDD and available assets, create:
      1. Technical architecture document
      2. Task breakdown for developers
      3. Test feature documentation
      4. Technology framework selection
      ${artAssets ? '5. Integration plan for art assets' : ''}
      ${musicAssets ? '6. Integration plan for music assets' : ''}
    `,
  };
}
```

#### 2.2 适配三种工作流
```typescript
// Agile: 架构师持续跟踪美术音频进度
// Waterfall: 架构师在策划后、研发前完成
// Hybrid: 灵活结合

function buildWorkflowStages(workflowType, agents, requirements) {
  switch (workflowType) {
    case 'agile':
      return buildAgileWorkflow(agents, requirements);
    case 'waterfall':
      return buildWaterfallWorkflow(agents, requirements);
    case 'hybrid':
      return buildHybridWorkflow(agents, requirements);
  }
}
```

---

### 阶段 3: 对话式创建功能（3-4小时）

#### 3.1 前端组件
**新建文件**: 
- `game-factory/frontend/src/components/ChatCreationDialog.tsx`
- `game-factory/frontend/src/components/CompanyChatCreator.tsx`
- `game-factory/frontend/src/components/AgentChatCreator.tsx`

```typescript
// ChatCreationDialog.tsx
interface ChatCreationDialogProps {
  open: boolean;
  onClose: () => void;
  type: 'company' | 'agent';
  onSuccess: (result: any) => void;
}

export const ChatCreationDialog: React.FC<ChatCreationDialogProps> = ({
  open, onClose, type, onSuccess
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    provider: 'openai',
    model: 'gpt-4o',
  });

  const handleSendMessage = async (content: string) => {
    // 调用后端对话接口
    const response = await fetch('/api/chat-creation', {
      method: 'POST',
      body: JSON.stringify({
        type,
        messages: [...messages, { role: 'user', content }],
        modelConfig,
      }),
    });

    // 处理流式响应
    const reader = response.body?.getReader();
    // ... 流式处理逻辑
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {type === 'company' ? '对话创建公司' : '对话创建 Agent'}
        <ModelSelector value={modelConfig} onChange={setModelConfig} />
      </DialogTitle>
      <DialogContent>
        <ChatMessageList messages={messages} />
        <ChatInput onSend={handleSendMessage} />
      </DialogContent>
    </Dialog>
  );
};
```

#### 3.2 后端接口
**新建文件**: `game-factory/backend/src/routes/chatCreation.ts`

```typescript
// POST /api/chat-creation
router.post('/chat-creation', authenticateToken, async (req, res) => {
  const { type, messages, modelConfig } = req.body;
  
  // 设置 SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // 调用大模型
    const completion = await callLLM(modelConfig, messages, {
      functions: type === 'company' 
        ? [createCompanyFunction] 
        : [createAgentFunction]
    });

    // 流式返回
    for await (const chunk of completion) {
      if (chunk.function_call) {
        // 执行 function call
        const result = await executeFunction(chunk.function_call);
        res.write(`data: ${JSON.stringify({ type: 'function_call', data: result })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ type: 'message', content: chunk.content })}\n\n`);
      }
    }
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  } finally {
    res.end();
  }
});
```

#### 3.3 Function Calling 定义
```typescript
const createCompanyFunction = {
  name: 'create_company',
  description: 'Create a new game development company',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Company name' },
      description: { type: 'string', description: 'Company description' },
      workflowType: { 
        type: 'string', 
        enum: ['agile', 'waterfall', 'hybrid'],
        description: 'Development workflow type'
      },
      maxEmployees: { type: 'number', description: 'Maximum employees' },
    },
    required: ['name', 'workflowType', 'maxEmployees']
  }
};

const createAgentFunction = {
  name: 'create_agent',
  description: 'Create a new employee agent',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { 
        type: 'string', 
        enum: ['planner', 'architect', 'artist', 'developer', 'tester', 'operator', 'music']
      },
      ai_model: { type: 'string' },
      specialization: { type: 'string' },
      extra_traits: { type: 'string' },
    },
    required: ['name', 'type', 'ai_model', 'specialization']
  }
};
```

---

### 阶段 4: 侧边栏抽屉功能（1小时）

#### 4.1 更新 Layout 组件
**文件**: `game-factory/frontend/src/components/Layout.tsx`

```typescript
export const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* 侧边栏 */}
      <Drawer
        variant="permanent"
        sx={{
          width: sidebarCollapsed ? 64 : 240,
          transition: 'width 0.3s ease',
          '& .MuiDrawer-paper': {
            width: sidebarCollapsed ? 64 : 240,
            transition: 'width 0.3s ease',
          },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {!sidebarCollapsed && <Typography variant="h6">Game Factory</Typography>}
          <IconButton onClick={toggleSidebar} size="small">
            {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Box>
        
        <List>
          {navItems.map((item) => (
            <ListItem key={item.path}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              {!sidebarCollapsed && <ListItemText primary={item.label} />}
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* 主内容区 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: sidebarCollapsed ? 8 : 30,
          transition: 'margin-left 0.3s ease',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
```

---

### 阶段 5: 更新公司创建逻辑（1小时）

#### 5.1 更新公司验证
**文件**: `game-factory/backend/src/routes/companies.ts`

```typescript
// 验证公司创建时必须有所有必需类型的 Agent
const REQUIRED_AGENT_TYPES = ['planner', 'architect', 'artist', 'developer', 'tester', 'music'];

function validateCompanyAgents(agentIds: number[]): boolean {
  // 查询所有 agent 类型
  const agents = await db.query('SELECT type FROM agents WHERE id IN (?)', [agentIds]);
  const types = agents.map(a => a.type);
  
  // 检查是否包含所有必需类型
  return REQUIRED_AGENT_TYPES.every(type => types.includes(type));
}
```

---

## 数据库迁移

### 迁移脚本
```sql
-- 添加 architect 类型支持（如果数据库有枚举约束）
ALTER TABLE agents MODIFY COLUMN type ENUM('planner', 'architect', 'artist', 'developer', 'tester', 'operator', 'music') NOT NULL;

-- 或者如果使用的是 CHECK 约束
ALTER TABLE agents DROP CONSTRAINT agents_type_check;
ALTER TABLE agents ADD CONSTRAINT agents_type_check 
  CHECK (type IN ('planner', 'architect', 'artist', 'developer', 'tester', 'operator', 'music'));
```

---

## UI 设计

### 对话创建界面
```
┌─────────────────────────────────────┐
│ 对话创建公司                [x]      │
│ 模型选择: [GPT-4o ▼]                │
├─────────────────────────────────────┤
│ 💬 助手: 您好！我来帮您创建一个      │
│         游戏开发公司。请告诉我...    │
│                                     │
│ 👤 用户: 我想创建一个叫"星际工作室" │
│         的公司                      │
│                                     │
│ 💬 助手: 好的！请问工作流类型...    │
│                                     │
│ 👤 用户: 敏捷开发                   │
│                                     │
│ 💬 助手: 🔧 正在创建公司...         │
│         ✅ 创建成功！                │
├─────────────────────────────────────┤
│ [输入消息...]            [发送 →]   │
└─────────────────────────────────────┘
```

### 侧边栏收缩效果
```
展开状态:                   收缩状态:
┌─────────────┐           ┌──┐
│ Game Factory│           │◀─│
│             │           ├──┤
│ 🏠 首页     │           │🏠│
│ 🏢 公司     │    →      │🏢│
│ 👥 Agent    │           │👥│
│ 🎮 项目     │           │🎮│
│             │           │  │
└─────────────┘           └──┘
```

---

## 测试计划

### 单元测试
- [ ] Agent 类型验证
- [ ] 工作流构建器
- [ ] Function calling 解析

### 集成测试
- [ ] 对话创建公司流程
- [ ] 对话创建 Agent 流程
- [ ] 架构师 Agent 在三种工作流中的表现

### E2E 测试
- [ ] 完整的公司创建到项目运行流程
- [ ] 侧边栏交互
- [ ] 对话界面交互

---

## 风险与挑战

1. **Function Calling 可靠性**: 大模型可能无法准确判断何时调用函数
   - 解决方案: 添加确认步骤，用户可以审核后再执行

2. **架构师 Agent 与其他 Agent 的协调**: 需要确保产物传递正确
   - 解决方案: 完善 workflowBuilder 的依赖管理

3. **UI 响应性**: 对话可能较慢，需要良好的加载状态
   - 解决方案: 使用流式响应，显示逐字输出

---

## 时间估算

| 阶段 | 预估时间 |
|------|----------|
| 类型定义与数据模型 | 1-2 小时 |
| 工作流集成 | 2-3 小时 |
| 对话式创建功能 | 3-4 小时 |
| 侧边栏抽屉功能 | 1 小时 |
| 测试与调试 | 2-3 小时 |
| **总计** | **9-13 小时** |

---

## 下一步行动

建议按以下顺序实施：

1. ✅ 完成类型定义（最基础）
2. ✅ 更新验证逻辑
3. ✅ 实现侧边栏抽屉（独立功能，可并行）
4. ✅ 更新工作流构建器
5. ✅ 实现对话式创建功能
6. ✅ 全面测试

**建议**: 由于工作量较大，可以分阶段实施，每个阶段都确保功能完整可用。
