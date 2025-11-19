import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';
import { connectKafka } from './config/kafka';
import logger from './utils/logger';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import coinRoutes from './routes/coins';
import companyRoutes from './routes/companies';
import agentRoutes from './routes/agents';
import marketRoutes from './routes/market';
import communityRoutes from './routes/community';
import gameRoutes from './routes/games';
import workflowRoutes from './routes/workflows';
import userAssetsRoutes from './routes/userAssets';
import agentTestRoutes from './routes/agentTest';
import { initWorkflowQueueConsumers } from './services/workflowQueue';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet());

// CORS 配置 - 支持多个源
const allowedOrigins = process.env.CORS_ALLOW_ORIGIN 
  ? process.env.CORS_ALLOW_ORIGIN.split(',') 
  : [process.env.FRONTEND_URL || 'http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如 Postman、服务器端请求）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100次请求
  message: '请求过于频繁，请稍后再试'
});
app.use(limiter);

// 日志
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// 压缩
app.use(compression());

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/user-assets', userAssetsRoutes);
app.use('/api/agents-test', agentTestRoutes);

// 静态文件服务
app.use('/uploads', express.static('uploads'));

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '未知错误'
  });
});

// 初始化服务
async function initializeServices() {
  try {
    logger.info('正在初始化服务...');
    
    // 连接数据库
    await connectDatabase();
    logger.info('数据库连接成功');
    
    // 连接Redis
    await connectRedis();
    logger.info('Redis连接成功');
    
    // 连接Kafka
    await connectKafka();
    logger.info('Kafka连接成功');

    await initWorkflowQueueConsumers();
    
    // 启动服务器
    app.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
    });
    
  } catch (error) {
    logger.error('服务初始化失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在优雅关闭...');
  process.exit(0);
});

// 启动应用
initializeServices();