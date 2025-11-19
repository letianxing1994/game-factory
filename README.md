# 🏭 game-factory · 游戏工厂管理平台

`game-factory` 是 AI 游戏开发系统的前端管理平台，提供公司管理、Agent 员工配置、工作流调度等功能。

---

## 📖 快速导航

- **[部署指南](DEPLOYMENT.md)** - 完整的本地/生产环境部署教程
- **[数据库设置](docs/DATABASE_SETUP.md)** - MySQL 数据库初始化
- **[配置说明](docs/CONFIGURATION.md)** - 环境变量和配置详解

---

## 1. 核心功能

- **队列与容量感知**：公司执行请求全部写入 `workflow-tasks`，UI 实时显示排队人数、ETA。
- **Clarification Loop**：当 my-agent-test 进入 `awaiting_clarification`，SSE 会把问题推送到前端，老板可在弹窗中回帖，答案会被代理转发回调度层。
- **Pause / Resume / Update**：为任意阶段生成按钮，允许对进行中的 Agent 注入新的资料或直接暂停。
- **Agent Preview**：在员工列表中“试运行”单个 Agent，支持查看/下载策划 GDD、美术纹理、代码包等产物。
- **资源上传与分片（占位）**：后端保留 OSS/GCS 代理能力，便于未来接入超大文件上传。
- **多公司/多 Workflow**：公司可选择 `linear` / `feedback` / `concurrent` 模板，也可自定义 stage 与模型。

## 2. 目录结构

```
game-factory/
├── backend/                # Express 服务
│   ├── src/
│   │   ├── app.ts          # 入口，加载 Kafka / Redis / Routes
│   │   ├── routes/         # companies / workflows / agents / ...
│   │   ├── services/       # workflowQueue (Kafka), myAgentClient, storage, ...
│   │   ├── middleware/     # auth、validation、rate limit、error handler
│   │   └── config/         # mysql, redis, kafka, logger
│   └── package.json
├── frontend/               # React + Vite
│   ├── src/pages/          # Companies.tsx, Agents.tsx, ...
│   ├── src/services/       # apiClient, hooks
│   └── package.json
├── database/schema.sql     # 初始化 SQL
└── deploy/                 # 多节点/多容器部署脚本
```

## 3. 前置依赖

| 组件          | 用途                                            |
| ------------- | ----------------------------------------------- |
| Node.js >=18  | backend + frontend 构建                         |
| MySQL         | 公司、员工、任务、Clarification 持久化          |
| Redis         | 高频查询缓存 / 会话 / Clarification 状态缓存     |
| Kafka         | `workflow-tasks`、`workflow-results`、`agent-events` |
| my-agent-test | 作为下游执行层，必须先部署并开放 API/SSE        |
| 对象存储 (可选) | 代理上传老板提供的美术/音频/3D 资源           |

## 4. Backend 快速开始

```bash
cd backend
npm install
cp env.example .env   # 若没有，可按下方说明新建
```

常用环境变量（按需裁剪）：

| 变量                    | 说明 |
| ----------------------- | ---- |
| `PORT`                  | API 端口，默认 4000                   |
| `MYSQL_HOST/USER/...`   | 数据库连接配置                        |
| `REDIS_URL`             | Redis 连接字符串                      |
| `KAFKA_BROKERS`         | 逗号分隔 broker 列表                  |
| `KAFKA_SSL` / `KAFKA_SASL_*` | 若使用托管 Kafka 可开启         |
| `A2A_BASE_URL`          | 指向 my-agent-test 的 REST/SSE 域名   |
| `A2A_WS_URL`            | Agent 预览 & 控制使用的 WS 地址       |
| `JWT_SECRET`            | 登录 token                            |
| `OSS_*` / `GCS_*`       | 可选：透传资源上传                    |

启动 backend：

```bash
npm run dev        # nodemon
# or
npm run build && npm start
```

> 初次运行记得执行 `database/schema.sql`（或用迁移工具导入）。

## 5. Frontend 快速开始

```bash
cd frontend
npm install
cp env.local.example .env.local
npm run dev        # Vite 本地开发
```

构建 & 预览：

```bash
npm run build
npm run preview
```

## 6. 主要工作流

1. 老板在 **Companies** 页面配置：公司章程、默认 Workflow、Agent、云资源、Planner 能力需求。
2. 点击 “运行公司” 时，后端将 payload 与 stage 配置打包，推送到 Kafka `workflow-tasks`。
3. `my-agent-test` 的 workflowConsumer 消费任务 → 实际执行 → 持续把状态发回 `workflow-results`。
4. backend 监听 `workflow-results`，更新 job 状态 & 通过 SSE 推送 Clarification / Stage 进度。
5. 前端实时展示排队人数、暂停/恢复按钮、Clarification 弹窗、Agent 预览结果。

## 7. 常用脚本

| 目录     | 命令                 | 说明                               |
| -------- | -------------------- | ---------------------------------- |
| backend  | `npm run dev`        | 开发模式（自动重启）               |
|          | `npm run lint`       | 需要补全 ESLint 配置后可启用       |
|          | `npm test`           | Jest（无测试时需 `--passWithNoTests`） |
| frontend | `npm run dev`        | Vite + React                       |
|          | `npm run lint`       | ESLint + React + TS                |
|          | `npm run build`      | 生成静态资源 `dist/`               |

## 8. 与 my-agent-test 的接口

- `POST /api/executions`：创建执行（game-factory backend 调用）。
- `POST /api/executions/preview`：Agent 试跑。
- `GET/POST /api/executions/:id/clarifications`：澄清问题和答案。
- `GET /api/executions/:id/events`：SSE，包含 `status`, `clarification`, `stage-update` 等事件。
- `POST /api/executions/:id/stages/:stageId/(pause|resume|updates)`：暂停、恢复、注入新需求。

所有请求都通过 backend 的 `myAgentClient` 代理，以便统一鉴权/打日志。

## 9. 部署建议

1. **基础设施**：Kafka、MySQL、Redis、对象存储、my-agent-test 建议分布式部署。详见 `DEPLOYMENT.md` 部署指南。
2. **Backend**：无状态，可横向扩展。务必设置 `KAFKA_CONSUMER_GROUP` 等避免重复消费。
3. **Frontend**：Vite 产物可托管到任意静态服务器（OSS、CloudFront、NGINX）。记得配置 `VITE_API_URL` 指向后端域名（HTTPS / WSS）。
4. **监控**：建议收集队列长度、Clarification backlog、SSE 连接数以及 Agent 预览耗时。

## 10. 开发约定

- 所有对 my-agent-test 的 API 调用都必须经过 `backend/src/services/myAgentClient.ts`，便于统一重试与日志。
- 新的后台任务 / topic 统一在 `workflowQueue.ts` 中注册，并更新 `backend/src/config/kafka.ts`。
- 前端新增的长连接请复用 `useEventSource` 模式，记得在组件卸载时关闭 SSE。
- 若扩展 Agent 类型或 Planner 能力选项，请同步更新：
  - `game-factory/frontend/src/pages/Companies.tsx`
  - `game-factory/backend/src/types/workflow.ts`
  - `my-agent-test/src/types.ts`

---

完成 README 后即可手动 `git push`。有任何问题请同步更新 `docs/architecture-distributed.md` 与部署脚本，保持上下游一致。祝开发顺利！🚀

