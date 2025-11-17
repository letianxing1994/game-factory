# Game Factory 快速配置指南

## 必需配置项（最小启动配置）

### 后端 (backend/.env)

```env
# 服务器
PORT=4000
NODE_ENV=development
LOG_LEVEL=info

# 数据库（MySQL）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=game_factory
DB_USER=game_factory
DB_PASSWORD=your_password

# Redis
REDIS_URL=redis://localhost:6379/1

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=game-factory-backend
WORKFLOW_TASK_TOPIC=workflow-tasks
WORKFLOW_RESULT_TOPIC=workflow-results

# JWT（⚠️ 必须修改）
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# my-agent-test 服务
MY_AGENT_BASE_URL=http://localhost:8080/api

# 前端 CORS
FRONTEND_URL=http://localhost:5173
```

### 前端 (frontend/.env.local)

```env
VITE_API_URL=http://localhost:4000
```

## 启动前检查清单

### 1. 数据库初始化
```bash
mysql -u root -p
CREATE DATABASE game_factory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
mysql -u root -p game_factory < database/schema.sql
```

### 2. 服务启动顺序
1. ✅ MySQL 服务
2. ✅ Redis 服务
3. ✅ Kafka 服务（如果使用）
4. ✅ my-agent-test 服务
5. ✅ game-factory 后端
6. ✅ game-factory 前端

### 3. 验证配置
```bash
# 后端健康检查
curl http://localhost:4000/health

# 应该返回：
# {"status":"ok","timestamp":"...","uptime":...}
```

## 详细配置说明

查看 [docs/CONFIGURATION.md](./docs/CONFIGURATION.md) 获取完整配置说明。

