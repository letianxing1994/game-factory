import { createClient } from 'redis';
import logger from '../utils/logger';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

const redisClient = createClient({
  url: redisUrl,
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000)
  }
});

redisClient.on('error', (err) => {
  logger.error('Redis连接错误:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis客户端已连接');
});

redisClient.on('ready', () => {
  logger.info('Redis客户端已就绪');
});

redisClient.on('end', () => {
  logger.info('Redis连接已关闭');
});

export async function connectRedis() {
  try {
    await redisClient.connect();
    logger.info('Redis连接成功');
  } catch (error) {
    logger.error('Redis连接失败:', error);
    throw error;
  }
}

export async function getCache(key: string) {
  try {
    return await redisClient.get(key);
  } catch (error) {
    logger.error('Redis获取缓存失败:', { key, error });
    return null;
  }
}

export async function setCache(key: string, value: string, expireSeconds?: number) {
  try {
    if (expireSeconds) {
      await redisClient.setEx(key, expireSeconds, value);
    } else {
      await redisClient.set(key, value);
    }
  } catch (error) {
    logger.error('Redis设置缓存失败:', { key, error });
  }
}

export async function delCache(key: string) {
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.error('Redis删除缓存失败:', { key, error });
  }
}

export { redisClient };