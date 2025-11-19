# 🏭 game-factory · AI游戏开发管理平台

`game-factory` 是一个基于多Agent协作的游戏开发管理系统，通过AI驱动的员工Agent完成游戏策划、美术、开发、测试等各个环节。

---

## 📖 快速导航

- **[数据库设置](docs/DATABASE_SETUP.md)** - MySQL 数据库初始化与迁移
- **[配置说明](docs/CONFIGURATION.md)** - 环境变量和配置详解
- **[启动脚本](#4-快速启动)** - 一键启动前后端服务

---

## 1. 核心功能

### 🏢 公司管理
- 创建游戏开发公司，配置员工数量和开发模式
- 支持敏捷、瀑布、混合等多种工作流模式
- 项目管理与工作流调度

### 👥 Agent员工管理
- **员工类型**：策划、美术(2D/3D)、技术、测试、音乐
- **AI模型配置**：
  - 策划: DeepSeek-R1, GPT-5, Claude Sonnet 4.5
  - 2D美术: DALL-E-3, Midjourney, Stable Diffusion
  - 3D美术: **双模型支持** (DALL-E-3贴图 + Meshy-4模型)
  - 技术: GPT-5, Claude, Deepseek Coder
  - 测试: Claude Sonnet 4.5, GPT-4o
  - 音乐: GPT-4o, Claude Sonnet 4.5
- **专业方向定制**：不同类型员工可配置擅长领域（游戏品类/画风/技术方向）
- **额外特点注入**：自定义特点文本，影响Agent执行时的系统提示词
- **试运行功能**：创建后可立即使用默认配置试运行，查看产出效果
- **员工操作**：雇佣、解雇、删除、更新配置

### 🎮 游戏项目开发
- 多阶段工作流：策划 → 美术 → 开发 → 测试
- 任务队列与进度追踪
- Agent协作产出游戏资产
- 实时查看产出物（GDD、贴图、代码、测试报告等）

### 🔄 工作流管理
- 异步任务队列（基于Kafka）
- 实时状态更新（SSE推送）
- 任务暂停/恢复/取消
- 多项目并行支持

---

## 2. 技术架构

```
┌──────────────┐      HTTP/SSE      ┌──────────────┐
│   Frontend   │ ◄──────────────── │   Backend    │
│  React+Vite  │                    │   Express    │
└──────────────┘                    └──────┬───────┘
                                           │
                 ┌─────────────────────────┼────────────────┐
                 │                         │                │
           ┌─────▼─────┐          ┌───────▼──────┐   ┌─────▼─────┐
           │   MySQL   │          │    Redis     │   │   Kafka   │
           │  Database │          │    Cache     │   │   Queue   │
           └───────────┘          └──────────────┘   └─────┬─────┘
                                                            │
                                                    ┌───────▼────────┐
                                                    │ my-agent-test  │
                                                    │  Agent执行层   │
                                                    └────────────────┘
```

### 核心技术栈
- **前端**: React 18 + TypeScript + Ant Design + Vite
- **后端**: Node.js + Express + TypeScript
- **数据库**: MySQL 8.0
- **缓存**: Redis
- **消息队列**: Kafka
- **Agent执行**: my-agent-test (独立服务)

---

## 3. 目录结构

```
game-factory/
├── backend/                    # Express后端服务
│   ├── src/
│   │   ├── app.ts             # 应用入口
│   │   ├── routes/            # API路由
│   │   │   ├── agents.ts      # Agent员工管理（含双模型支持）
│   │   │   ├── companies.ts   # 公司管理
│   │   │   ├── workflows.ts   # 工作流调度
│   │   │   ├── auth.ts        # 用户认证
│   │   │   └── ...
│   │   ├── services/          # 业务服务
│   │   │   ├── workflowQueue.ts      # Kafka任务队列
│   │   │   ├── myAgentClient.ts      # my-agent-test客户端
│   │   │   └── workflowBuilder.ts    # 工作流构建器
│   │   ├── middleware/        # 中间件
│   │   └── config/            # 配置（MySQL/Redis/Kafka）
│   └── package.json
├── frontend/                   # React前端
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── Agents.tsx     # Agent管理（试运行/删除/双模型）
│   │   │   ├── Companies.tsx  # 公司管理
│   │   │   ├── Games.tsx      # 游戏项目
│   │   │   └── ...
│   │   ├── services/          # API客户端
│   │   ├── components/        # 公共组件
│   │   └── contexts/          # React Context
│   └── package.json
├── database/                   # 数据库脚本
│   ├── schema.sql             # 初始化SQL
│   ├── add-dual-models.sql    # 双模型迁移SQL
│   ├── migrate-dual-models.bat # 迁移脚本（Windows）
│   └── README.md              # 数据库文档
└── docs/                       # 项目文档
    ├── DATABASE_SETUP.md      # 数据库设置指南
    └── CONFIGURATION.md       # 配置说明
```

---

## 4. 快速启动

### 前置要求
- Node.js >= 18
- Docker (用于运行MySQL/Redis/Kafka)
- my-agent-test 服务已部署并运行

### 一键启动

#### Windows

```powershell
# 启动后端（在backend目录打开终端）
.\start-backend.ps1

# 启动前端（在frontend目录打开新终端）
.\start-frontend.ps1
```

#### 手动启动

```bash
# 1. 启动后端
cd backend
npm install
cp env.example .env    # 配置环境变量
npm run dev            # 开发模式
# npm run build && npm start  # 生产模式

# 2. 启动前端
cd frontend
npm install
cp env.local.example .env.local
npm run dev            # 访问 http://localhost:3002
```

### 初始化数据库

```bash
# 方法1: 使用Docker Compose
docker-compose up -d mysql

# 方法2: 手动执行SQL
cd database
# 进入MySQL容器
docker exec -it mysql mysql -uroot -p
# 执行 schema.sql
```

详细步骤参见 [数据库设置文档](docs/DATABASE_SETUP.md)

---

## 5. 配置说明

### Backend环境变量 (backend/.env)

```env
# 服务配置
PORT=4000
NODE_ENV=development

# 数据库
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=mydb

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=game-factory

# my-agent-test API
A2A_BASE_URL=http://localhost:3000
A2A_WS_URL=ws://localhost:3000

# JWT认证
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# 可选：对象存储
# OSS_REGION=oss-cn-hangzhou
# OSS_ACCESS_KEY_ID=xxx
# OSS_ACCESS_KEY_SECRET=xxx
# OSS_BUCKET=game-factory
```

### Frontend环境变量 (frontend/.env.local)

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000
```

更多配置详情参见 [配置文档](docs/CONFIGURATION.md)

---

## 6. 核心特性详解

### 🎨 3D美术双模型支持

3D美术Agent使用两个AI模型协作：
- **ai_model_2d**: 生成贴图、概念图（推荐DALL-E-3）
- **ai_model_3d**: 生成3D模型（推荐Meshy-4）

创建3D美术员工时可分别选择两个模型，系统会自动在不同环节调用相应模型。

### 🚀 Agent试运行

创建Agent后可立即试运行：
1. 点击"试运行"按钮
2. 确认使用默认配置（自动生成项目名称、RPG类型）
3. 查看产出结果：
   - 策划: GDD文档
   - 美术: 图片/3D模型
   - 技术: 代码包
   - 测试: 测试报告

### 🔄 异步任务处理

所有工作流任务通过Kafka队列异步处理：
```
用户提交 → Kafka队列 → my-agent-test消费 → 产出结果 → SSE推送前端
```

前端实时显示：
- 队列位置
- 预计等待时间
- 执行状态
- 产出物下载链接

---

## 7. API文档

### Agent管理API

```typescript
// 创建Agent员工
POST /agents
{
  name: string
  type: 'planner' | 'artist' | 'developer' | 'tester' | 'music'
  dimension?: '2d' | '3d'  // 美术类型必填
  ai_model?: string         // 非美术类型单一模型
  ai_model_2d?: string      // 美术类型2D模型
  ai_model_3d?: string      // 美术类型3D模型（仅3D）
  specialization: string    // 专业方向
  extra_traits?: string     // 额外特点
  companyId?: number        // 可选：直接分配到公司
}

// 获取我的Agent列表
GET /agents/my?status=all&type=artist

// 删除Agent
DELETE /agents/:id

// Agent试运行
POST /workflows/agents/:id/preview
{
  project: { projectName, description }
  stage: { stageId, mode }
  userInput: { gameGenre, dimension, artStyle, ... }
}
```

### 公司管理API

```typescript
// 创建公司
POST /companies
{
  name: string
  description: string
  maxEmployees: number
  workflowType: 'agile' | 'waterfall' | 'hybrid'
}

// 启动游戏项目
POST /companies/:id/start-game
{
  name: string
  genre: string
  agents: { planner, artists, developers, testers }
}
```

---

## 8. 开发指南

### 添加新的Agent类型

1. 更新数据库schema（`agents.type`枚举）
2. 在frontend添加AI模型选项（`Agents.tsx`）
3. 在backend添加专业方向映射（`agents.ts`）
4. 在my-agent-test添加对应的Agent实现

### 扩展工作流

1. 定义新的stage类型（`workflow.ts`）
2. 在workflowBuilder添加stage构建逻辑
3. my-agent-test实现新stage的处理器
4. 前端添加UI展示

---

## 9. 常见问题

### Q: 创建Agent后列表不刷新？
A: 已修复缓存问题，确保后端版本包含Redis通配符清除逻辑。

### Q: 3D美术Agent只显示一个模型？
A: 执行 `database/migrate-dual-models.bat` 添加双模型字段。

### Q: 试运行失败？
A: 检查my-agent-test服务是否运行，确认A2A_BASE_URL配置正确。

### Q: Kafka连接失败？
A: 检查docker-compose中Kafka容器状态，确认端口9092可访问。

---

## 10. 版本历史

### v1.3.0 (当前)
- ✅ 3D美术双模型支持（ai_model_2d + ai_model_3d）
- ✅ Agent删除功能
- ✅ 试运行确认弹窗
- ✅ 修复缓存刷新问题
- ✅ 简化试运行流程（自动使用默认配置）

### v1.2.0
- ✅ Agent字段重构（移除9个冗余字段）
- ✅ 2D/3D美术分离
- ✅ 专业方向与AI模型解耦
- ✅ 额外特点注入系统

### v1.1.0
- ✅ 公司与Agent参数分离
- ✅ 项目配置独立管理
- ✅ 工作流模板系统

---

## 11. 贡献与支持

- 项目仓库: [GitHub](https://github.com/letianxing1994/game-factory)
- 问题反馈: [Issues](https://github.com/letianxing1994/game-factory/issues)

---

## 12. 许可证

MIT License
