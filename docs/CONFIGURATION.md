# Game Factory 配置说明

本文档详细说明 `game-factory` 项目启动所需的所有配置项。

## 目录结构

```
game-factory/
├── backend/
│   ├── .env                    # 后端环境变量（从 env.example 复制）
│   └── env.example             # 后端环境变量模板
├── frontend/
│   ├── .env.local              # 前端环境变量（从 env.local.example 复制）
│   └── env.local.example       # 前端环境变量模板
└── database/
    └── schema.sql              # 数据库初始化脚本
```

## 快速开始

### 1. 数据库初始化

首先需要创建 MySQL 数据库并执行初始化脚本：

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE game_factory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 执行初始化脚本
mysql -u root -p game_factory < database/schema.sql
```

### 2. 后端配置

复制环境变量模板并填写配置：

```bash
cd backend
cp env.example .env
# 编辑 .env 文件，填写实际配置值
```

### 3. 前端配置

复制环境变量模板并填写配置：

```bash
cd frontend
cp env.local.example .env.local
# 编辑 .env.local 文件，填写实际配置值
```

## 配置项详细说明

### 后端配置 (backend/.env)

#### 🔴 必需配置（核心功能）

##### 1. 服务器基础配置

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `PORT` | 后端服务端口 | `3000` | `4000` |
| `NODE_ENV` | 运行环境 | - | `development` / `production` |
| `LOG_LEVEL` | 日志级别 | `info` | `debug` / `info` / `warn` / `error` |

##### 2. 数据库配置（MySQL）

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `DB_HOST` | 数据库主机地址 | `localhost` | `localhost` / `192.168.1.100` |
| `DB_PORT` | 数据库端口 | `3306` | `3306` |
| `DB_NAME` | 数据库名称 | `game_factory` | `game_factory` |
| `DB_USER` | 数据库用户名 | `root` | `game_factory_user` |
| `DB_PASSWORD` | 数据库密码 | `''` | `your_secure_password` |

**注意**：代码同时支持 `MYSQL_*` 前缀（向后兼容），但优先使用 `DB_*` 前缀。

##### 3. Redis 缓存配置

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `REDIS_URL` | Redis 连接 URL | `redis://localhost:6379/1` | `redis://localhost:6379/1` |
| `REDIS_HOST` | Redis 主机（可选，如果设置了 REDIS_URL 则忽略） | `localhost` | `localhost` |
| `REDIS_PORT` | Redis 端口（可选） | `6379` | `6379` |
| `REDIS_PASSWORD` | Redis 密码（可选） | - | `redis_password` |

##### 4. Kafka 消息队列配置

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `KAFKA_BROKERS` | Kafka Broker 地址（逗号分隔） | `localhost:9092` | `localhost:9092` / `kafka1:9092,kafka2:9092` |
| `KAFKA_CLIENT_ID` | Kafka 客户端 ID | `game-factory-backend` | `game-factory-backend` |
| `KAFKA_GROUP_ID` | Kafka 消费者组 ID | `game-factory-api` | `game-factory-api` |
| `WORKFLOW_TASK_TOPIC` | Workflow 任务 Topic | `workflow-tasks` | `workflow-tasks` |
| `WORKFLOW_RESULT_TOPIC` | Workflow 结果 Topic | `workflow-results` | `workflow-results` |
| `WORKFLOW_RESULT_GROUP` | Workflow 结果消费者组 | `game-factory-workflow-results` | `game-factory-workflow-results` |

**Kafka SSL/SASL 配置（可选）**：

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `KAFKA_SSL` | 是否启用 SSL | `false` | `true` / `false` |
| `KAFKA_SASL_MECHANISM` | SASL 认证机制 | `plain` | `plain` / `scram-sha-256` / `scram-sha-512` |
| `KAFKA_SASL_USERNAME` | SASL 用户名 | - | `kafka_user` |
| `KAFKA_SASL_PASSWORD` | SASL 密码 | - | `kafka_password` |

##### 5. JWT 认证配置

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `JWT_SECRET` | JWT 签名密钥（**必须修改**） | `replace-me` | `your-super-secret-jwt-key-here` |
| `JWT_EXPIRES_IN` | Token 过期时间 | `7d` | `7d` / `24h` / `1h` |

**⚠️ 安全警告**：生产环境必须使用强随机字符串作为 `JWT_SECRET`！

##### 6. my-agent-test 服务集成

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `MY_AGENT_BASE_URL` | my-agent-test API 基础 URL | `http://localhost:8080/api` | `http://localhost:8080/api` |
| `MY_AGENT_API_KEY` | my-agent-test API 密钥（如果启用） | - | `your-api-key` |

#### 🟡 可选配置（增强功能）

##### 7. Workflow 队列性能配置

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `WORKFLOW_CONCURRENCY` | 并发执行的 Workflow 数量 | `25` | `50` |
| `WORKFLOW_AVG_TIME_MS` | 平均每个阶段耗时（毫秒，用于估算等待时间） | `180000` | `180000` (3分钟) |

##### 8. 前端 CORS 配置

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `FRONTEND_URL` | 前端应用 URL（用于 CORS） | `http://localhost:3001` | `http://localhost:5173` |

##### 9. 对象存储配置（可选）

**阿里云 OSS**：

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `OSS_REGION` | OSS 区域 | `oss-cn-hangzhou` | `oss-cn-hangzhou` |
| `OSS_ACCESS_KEY_ID` | OSS AccessKey ID | - | `your-access-key-id` |
| `OSS_ACCESS_KEY_SECRET` | OSS AccessKey Secret | - | `your-access-key-secret` |
| `OSS_BUCKET` | OSS Bucket 名称 | - | `game-factory-assets` |

**Google Cloud Storage**：

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `GCP_PROJECT_ID` | GCP 项目 ID | - | `your-gcp-project` |
| `GCS_BUCKET` | GCS Bucket 名称 | - | `game-factory-assets` |
| `GCS_CREDENTIALS_JSON` | GCS 服务账号 JSON 凭证（Base64 编码或文件路径） | - | `{"type":"service_account",...}` |

##### 10. 速率限制配置（可选）

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `RATE_LIMIT_WINDOW_MS` | 限流时间窗口（毫秒） | `60000` | `60000` (1分钟) |
| `RATE_LIMIT_MAX` | 时间窗口内最大请求数 | `120` | `200` |

### 前端配置 (frontend/.env.local)

#### 🔴 必需配置

| 配置项 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `VITE_API_URL` | 后端 API 基础 URL | `/api` | `http://localhost:4000` |

**注意**：前端使用 Vite，环境变量必须以 `VITE_` 开头才能在前端代码中访问。

## 配置检查清单

在启动服务前，请确认以下配置已正确填写：

### 后端检查清单

- [ ] ✅ `PORT` - 后端服务端口
- [ ] ✅ `NODE_ENV` - 运行环境
- [ ] ✅ `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - 数据库连接
- [ ] ✅ `REDIS_URL` - Redis 连接
- [ ] ✅ `KAFKA_BROKERS` - Kafka 连接
- [ ] ✅ `JWT_SECRET` - **必须修改为强随机字符串**
- [ ] ✅ `MY_AGENT_BASE_URL` - my-agent-test 服务地址
- [ ] ⚠️ `MY_AGENT_API_KEY` - 如果 my-agent-test 启用了 API 密钥认证
- [ ] ⚠️ `FRONTEND_URL` - 前端 URL（用于 CORS）

### 前端检查清单

- [ ] ✅ `VITE_API_URL` - 后端 API 地址

### 基础设施检查清单

- [ ] ✅ MySQL 数据库已创建并执行了 `schema.sql`
- [ ] ✅ Redis 服务已启动
- [ ] ✅ Kafka 服务已启动（如果使用）
- [ ] ✅ my-agent-test 服务已启动并可访问

## 启动顺序

1. **启动基础设施**：
   ```bash
   # 启动 MySQL
   # 启动 Redis
   # 启动 Kafka（如果使用）
   ```

2. **启动 my-agent-test 服务**：
   ```bash
   cd my-agent-test
   npm start
   ```

3. **启动 game-factory 后端**：
   ```bash
   cd game-factory/backend
   npm install
   npm run build  # 如果使用 TypeScript
   npm start
   ```

4. **启动 game-factory 前端**：
   ```bash
   cd game-factory/frontend
   npm install
   npm run dev
   ```

## 配置验证

### 后端健康检查

启动后端后，访问健康检查端点：

```bash
curl http://localhost:4000/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### 数据库连接测试

后端启动时会自动测试数据库连接，如果失败会在日志中显示错误信息。

### Redis 连接测试

后端启动时会自动测试 Redis 连接，如果失败会在日志中显示错误信息。

### Kafka 连接测试

后端启动时会自动测试 Kafka 连接，如果失败会在日志中显示错误信息。

## 常见问题

### 1. 数据库连接失败

**问题**：`数据库连接失败`

**解决方案**：
- 检查 MySQL 服务是否启动
- 检查 `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` 是否正确
- 检查数据库用户是否有权限访问指定数据库
- 检查防火墙是否阻止了连接

### 2. Redis 连接失败

**问题**：`Redis连接失败`

**解决方案**：
- 检查 Redis 服务是否启动
- 检查 `REDIS_URL` 是否正确
- 如果设置了密码，检查 `REDIS_PASSWORD` 是否正确
- 检查防火墙是否阻止了连接

### 3. Kafka 连接失败

**问题**：`Kafka连接失败`

**解决方案**：
- 检查 Kafka 服务是否启动
- 检查 `KAFKA_BROKERS` 是否正确
- 如果启用了 SSL/SASL，检查相关配置是否正确
- 检查防火墙是否阻止了连接

### 4. my-agent-test 服务不可达

**问题**：`提交workflow失败` 或 `获取执行详情失败`

**解决方案**：
- 检查 my-agent-test 服务是否启动
- 检查 `MY_AGENT_BASE_URL` 是否正确
- 如果启用了 API 密钥，检查 `MY_AGENT_API_KEY` 是否正确
- 检查网络连接和防火墙

### 5. 前端无法连接后端

**问题**：前端请求后端 API 失败

**解决方案**：
- 检查 `VITE_API_URL` 是否正确
- 检查后端服务是否启动
- 检查 CORS 配置（`FRONTEND_URL`）是否正确
- 检查浏览器控制台的错误信息

### 6. JWT 认证失败

**问题**：`访问令牌无效`

**解决方案**：
- 检查 `JWT_SECRET` 是否与生成 Token 时使用的密钥一致
- 检查 Token 是否过期（`JWT_EXPIRES_IN`）
- 检查请求头中是否包含正确的 `Authorization: Bearer <token>`

## 生产环境建议

### 安全配置

1. **JWT_SECRET**：使用强随机字符串（至少 32 字符）
   ```bash
   # 生成随机密钥
   openssl rand -base64 32
   ```

2. **数据库密码**：使用强密码，不要使用默认值

3. **Redis 密码**：生产环境建议启用 Redis 密码

4. **Kafka SSL/SASL**：生产环境建议启用 SSL 和 SASL 认证

5. **HTTPS**：生产环境建议使用 HTTPS（通过反向代理如 Nginx）

### 性能配置

1. **WORKFLOW_CONCURRENCY**：根据服务器资源调整并发数
2. **数据库连接池**：在 `database.ts` 中调整 `connectionLimit`
3. **Redis 连接**：根据负载调整 Redis 连接配置

### 监控和日志

1. **LOG_LEVEL**：生产环境建议使用 `info` 或 `warn`
2. 配置日志收集系统（如 ELK、Loki）
3. 配置监控告警（如 Prometheus + Grafana）

## 配置示例

### 开发环境完整配置示例

**backend/.env**：
```env
PORT=4000
NODE_ENV=development
LOG_LEVEL=debug

DB_HOST=localhost
DB_PORT=3306
DB_NAME=game_factory
DB_USER=game_factory_user
DB_PASSWORD=dev_password

REDIS_URL=redis://localhost:6379/1

KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=game-factory-backend
WORKFLOW_TASK_TOPIC=workflow-tasks
WORKFLOW_RESULT_TOPIC=workflow-results

JWT_SECRET=dev-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=7d

MY_AGENT_BASE_URL=http://localhost:8080/api

FRONTEND_URL=http://localhost:5173
```

**frontend/.env.local**：
```env
VITE_API_URL=http://localhost:4000
```

### 生产环境配置示例

**backend/.env**：
```env
PORT=4000
NODE_ENV=production
LOG_LEVEL=info

DB_HOST=db.example.com
DB_PORT=3306
DB_NAME=game_factory
DB_USER=game_factory_prod
DB_PASSWORD=<strong-random-password>

REDIS_URL=redis://redis.example.com:6379/1
REDIS_PASSWORD=<redis-password>

KAFKA_BROKERS=kafka1.example.com:9092,kafka2.example.com:9092
KAFKA_CLIENT_ID=game-factory-backend-prod
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_SASL_USERNAME=kafka_user
KAFKA_SASL_PASSWORD=<kafka-password>
WORKFLOW_TASK_TOPIC=workflow-tasks-prod
WORKFLOW_RESULT_TOPIC=workflow-results-prod

JWT_SECRET=<strong-random-32-char-secret>
JWT_EXPIRES_IN=24h

MY_AGENT_BASE_URL=https://my-agent-test.example.com/api
MY_AGENT_API_KEY=<api-key>

WORKFLOW_CONCURRENCY=50
WORKFLOW_AVG_TIME_MS=180000

FRONTEND_URL=https://game-factory.example.com

OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=<oss-key-id>
OSS_ACCESS_KEY_SECRET=<oss-key-secret>
OSS_BUCKET=game-factory-assets-prod

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=200
```

**frontend/.env.local**：
```env
VITE_API_URL=https://api.game-factory.example.com
```

## 总结

- **必需配置**：服务器、数据库、Redis、Kafka、JWT、my-agent-test 集成
- **可选配置**：对象存储、速率限制、性能调优
- **安全建议**：生产环境必须修改 JWT_SECRET，启用密码认证
- **启动顺序**：基础设施 → my-agent-test → game-factory 后端 → game-factory 前端

如有问题，请查看日志文件或联系开发团队。

