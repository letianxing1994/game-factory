6# 📦 game-factory 部署指南

## 一、本地开发环境

### 1.1 前置依赖

```bash
Node.js >= 18.x
MySQL >= 8.0
Redis >= 6.0
my-agent-test (必须先部署)
```

### 1.2 数据库初始化

```bash
# Windows
cd database
.\import.bat

# Linux/Mac
cd database
chmod +x import.sh
./import.sh
```

或手动导入：

```bash
mysql -u root -p < database/schema.sql
```

### 1.3 Backend 启动

```bash
cd backend

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp env.example .env

# 编辑 .env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=game_factory

REDIS_HOST=localhost
REDIS_PORT=6379

A2A_SERVER_URL=http://localhost:3000  # my-agent-test 地址
JWT_SECRET=your-secret-key

# 3. 启动服务
npm run dev
# 服务运行在 http://localhost:4000
```

### 1.4 Frontend 启动

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp env.local.example .env.local

# 编辑 .env.local
VITE_API_URL=http://localhost:4000

# 3. 启动开发服务器
npm run dev
# 服务运行在 http://localhost:5173
```

### 1.5 验证部署

访问 http://localhost:5173，应该能看到登录页面。

---

## 二、Docker Compose 部署

### 2.1 完整配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: game_factory
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  my-agent-test:
    image: my-agent-test:latest
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - MESHY_API_KEY=${MESHY_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - ALIYUN_OSS_REGION=${ALIYUN_OSS_REGION}
      - ALIYUN_OSS_ACCESS_KEY_ID=${ALIYUN_OSS_ACCESS_KEY_ID}
      - ALIYUN_OSS_ACCESS_KEY_SECRET=${ALIYUN_OSS_ACCESS_KEY_SECRET}
      - ALIYUN_OSS_BUCKET=${ALIYUN_OSS_BUCKET}
    volumes:
      - my_agent_data:/app/data
    restart: unless-stopped

  game-factory-backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - PORT=4000
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=rootpassword
      - DB_NAME=game_factory
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - A2A_SERVER_URL=http://my-agent-test:3000
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mysql
      - redis
      - my-agent-test
    restart: unless-stopped

  game-factory-frontend:
    build: ./frontend
    ports:
      - "5173:80"
    environment:
      - VITE_API_URL=http://localhost:4000
    depends_on:
      - game-factory-backend
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
  my_agent_data:
```

### 2.2 启动服务

```bash
# 创建 .env 文件
cat > .env << EOF
DEEPSEEK_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx
MESHY_API_KEY=msy_xxx
ANTHROPIC_API_KEY=sk-ant-xxx
ALIYUN_OSS_REGION=oss-cn-shanghai
ALIYUN_OSS_ACCESS_KEY_ID=xxx
ALIYUN_OSS_ACCESS_KEY_SECRET=xxx
ALIYUN_OSS_BUCKET=my-game-assets
JWT_SECRET=$(openssl rand -hex 32)
EOF

# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## 三、生产环境部署

### 3.1 架构说明

```
                    ┌─────────────┐
                    │   Nginx     │ (SSL, Load Balancer)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                                 │
    ┌─────▼─────┐                    ┌─────▼─────┐
    │  Frontend │                    │  Backend  │
    │  (React)  │                    │ (Express) │
    └───────────┘                    └─────┬─────┘
                                           │
                     ┌─────────────────────┼─────────────┐
                     │                     │             │
               ┌─────▼─────┐         ┌────▼────┐   ┌───▼────┐
               │   MySQL   │         │  Redis  │   │  A2A   │
               └───────────┘         └─────────┘   └────────┘
```

### 3.2 Nginx 配置

```nginx
# /etc/nginx/sites-available/game-factory
upstream backend {
    server 127.0.0.1:4000;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/game-factory/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE 支持
    location /api/sse/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}
```

### 3.3 使用 PM2 管理进程

```bash
# 安装 PM2
npm install -g pm2

# Backend
cd backend
pm2 start npm --name "game-factory-backend" -- start
pm2 save
pm2 startup

# 配置文件方式
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'game-factory-backend',
    script: 'npm',
    args: 'start',
    cwd: './backend',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 4000
    }
  }]
}
EOF

pm2 start ecosystem.config.js
```

### 3.4 构建 Frontend

```bash
cd frontend
npm run build

# 产物在 dist/ 目录
# 部署到 Nginx
sudo cp -r dist/* /var/www/game-factory/frontend/
```

---

## 四、数据库配置

### 4.1 生产环境优化

```sql
-- 调整 MySQL 配置 /etc/mysql/my.cnf
[mysqld]
max_connections = 500
innodb_buffer_pool_size = 2G
innodb_log_file_size = 512M
query_cache_size = 0
query_cache_type = 0

-- 创建只读用户
CREATE USER 'game_factory_ro'@'%' IDENTIFIED BY 'readonly_password';
GRANT SELECT ON game_factory.* TO 'game_factory_ro'@'%';
FLUSH PRIVILEGES;
```

### 4.2 数据备份

```bash
# 每日自动备份脚本
cat > /usr/local/bin/backup-game-factory-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/game-factory"
mkdir -p $BACKUP_DIR

mysqldump -u root -p${DB_PASSWORD} game_factory \
  | gzip > $BACKUP_DIR/game_factory_$DATE.sql.gz

# 保留最近 7 天的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# 上传到对象存储
ossutil cp $BACKUP_DIR/game_factory_$DATE.sql.gz \
  oss://my-backups/game-factory/
EOF

chmod +x /usr/local/bin/backup-game-factory-db.sh

# 添加到 crontab
crontab -e
# 每天凌晨 2 点备份
0 2 * * * /usr/local/bin/backup-game-factory-db.sh
```

---

## 五、Redis 配置

### 5.1 持久化配置

```bash
# /etc/redis/redis.conf
save 900 1
save 300 10
save 60 10000

appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
```

### 5.2 缓存策略

```javascript
// backend/src/config/redis.ts
import Redis from 'ioredis'

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => {
    return Math.min(times * 50, 2000)
  },
})

// 缓存配置
export const CACHE_TTL = {
  USER: 3600,        // 1 hour
  AGENT: 1800,       // 30 minutes
  COMPANY: 1800,
  WORKFLOW: 600,     // 10 minutes
}
```

---

## 六、环境变量配置

### 6.1 Backend 环境变量

```bash
# backend/.env (生产环境)
NODE_ENV=production
PORT=4000

# Database
DB_HOST=mysql-prod.example.com
DB_PORT=3306
DB_USER=game_factory
DB_PASSWORD=strong_password_here
DB_NAME=game_factory
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis
REDIS_HOST=redis-prod.example.com
REDIS_PORT=6379
REDIS_PASSWORD=redis_password_here

# Services
A2A_SERVER_URL=http://my-agent-test:3000

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://yourdomain.com
```

### 6.2 Frontend 环境变量

```bash
# frontend/.env.production
VITE_API_URL=https://yourdomain.com/api
VITE_APP_NAME=Game Factory
VITE_APP_VERSION=1.0.0
```

---

## 七、监控与日志

### 7.1 日志聚合

```bash
# 使用 PM2 日志
pm2 logs game-factory-backend

# 或配置日志文件
# backend/src/utils/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
  ],
})
```

### 7.2 性能监控

```bash
# 使用 PM2 监控
pm2 monit

# 或集成 APM 工具
npm install @sentry/node
npm install newrelic

# backend/src/app.ts
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
})
```

---

## 八、故障排查

### 8.1 常见问题

**问题 1: 数据库连接失败**

```bash
# 检查 MySQL 是否运行
systemctl status mysql

# 测试连接
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME

# 检查防火墙
sudo ufw allow 3306/tcp
```

**问题 2: Redis 连接超时**

```bash
# 检查 Redis
redis-cli ping

# 检查配置
redis-cli CONFIG GET bind
redis-cli CONFIG GET protected-mode
```

**问题 3: Frontend 无法连接 Backend**

```bash
# 检查 CORS 配置
# backend/src/app.ts
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}))

# 检查网络
curl http://localhost:4000/api/health
```

**问题 4: 美术 Agent 创建时 dimension 丢失**

```bash
# 检查数据库字段
mysql> DESCRIBE agents;
# 确保有 dimension VARCHAR(10) 字段

# 如果缺失，手动添加
ALTER TABLE agents ADD COLUMN dimension VARCHAR(10) 
  COMMENT '维度：2d或3d（仅美术类型需要）' 
  AFTER type;

# 检查前端是否传递
# frontend/src/pages/Agents.tsx
# 确保表单提交时包含 dimension 字段
```

### 8.2 调试模式

```bash
# Backend
DEBUG=* npm run dev

# 查看详细日志
export LOG_LEVEL=debug
npm run dev
```

---

## 九、安全加固

### 9.1 防火墙配置

```bash
# 仅允许必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 9.2 SSL 证书

```bash
# 使用 Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### 9.3 限流与防护

```javascript
// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit'

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
})

// app.ts
app.use('/api/', apiLimiter)
```

---

## 十、联系与支持

- **文档**: [docs/CONFIGURATION.md](docs/CONFIGURATION.md)
- **数据库**: [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md)
- **Issues**: GitHub Issues
