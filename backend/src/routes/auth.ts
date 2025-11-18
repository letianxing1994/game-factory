import { Router } from 'express';
import { query } from '../config/database';
import { generateToken, authenticate, AuthRequest } from '../middleware/auth';
import { validate, registerSchema, loginSchema } from '../middleware/validation';
import { hashPassword, comparePassword } from '../utils/password';
import { sendMessage } from '../config/kafka';
import logger from '../utils/logger';

const router = Router();

// 用户注册
router.post('/register', validate(registerSchema), async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // 检查用户名是否已存在
    const existingUser = await query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (Array.isArray(existingUser) && existingUser.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: '用户名或邮箱已存在',
        error: '用户名或邮箱已存在' 
      });
    }

    // 密码加密
    const passwordHash = await hashPassword(password);

    // 获取系统配置：新用户初始游戏币
    const systemConfig = await query('SELECT config_value FROM system_configs WHERE config_key = ?', ['new_user_initial_coins']);
    const initialCoins = systemConfig.length > 0 ? parseFloat(systemConfig[0].config_value) : 10000.00;

    // 创建用户
    const result = await query(
      'INSERT INTO users (username, email, password_hash, game_coins) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, initialCoins]
    );

    const userId = (result as any).insertId;

    // 发送用户注册事件到Kafka
    await sendMessage('user-events', {
      type: 'user_registered',
      userId,
      username,
      email,
      initialCoins
    });

    // 生成JWT令牌
    const token = generateToken({ id: userId, username, email });

    logger.info(`用户注册成功: ${username}`);

    res.status(201).json({
      success: true,
      message: '用户注册成功',
      data: {
        token,
        user: {
          id: userId,
          username,
          email,
          game_coins: initialCoins
        }
      }
    });

  } catch (error) {
    logger.error('用户注册失败:', error);
    res.status(500).json({ 
      success: false,
      message: '注册失败，请稍后重试',
      error: '注册失败，请稍后重试' 
    });
  }
});

// 用户登录
router.post('/login', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  try {
    // 查找用户
    const users = await query('SELECT id, username, email, password_hash, game_coins, status FROM users WHERE username = ?', [username]);
    
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: '用户名或密码错误',
        error: '用户名或密码错误' 
      });
    }

    const user = users[0];

    // 检查用户状态
    if (user.status === 0) {
      return res.status(403).json({ 
        success: false,
        message: '账户已被禁用',
        error: '账户已被禁用' 
      });
    }

    // 验证密码
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: '用户名或密码错误',
        error: '用户名或密码错误' 
      });
    }

    // 生成JWT令牌
    const token = generateToken({ 
      id: user.id, 
      username: user.username, 
      email: user.email 
    });

    // 发送用户登录事件到Kafka
    await sendMessage('user-events', {
      type: 'user_logged_in',
      userId: user.id,
      username: user.username,
      loginTime: new Date().toISOString()
    });

    logger.info(`用户登录成功: ${username}`);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          game_coins: user.game_coins
        }
      }
    });

  } catch (error) {
    logger.error('用户登录失败:', error);
    res.status(500).json({ 
      success: false,
      message: '登录失败，请稍后重试',
      error: '登录失败，请稍后重试' 
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const users = await query(
      'SELECT id, username, email, game_coins, reputation, status, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: '用户不存在' 
      });
    }
    
    const user = users[0];
    
    res.json({
      success: true,
      data: user
    });
    
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({ 
      success: false,
      message: '获取用户信息失败' 
    });
  }
});

// 刷新令牌
router.post('/refresh', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: '令牌缺失',
      error: '令牌缺失' 
    });
  }

  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    // 检查用户是否仍然存在且状态正常
    const users = await query('SELECT id, username, email, status FROM users WHERE id = ?', [decoded.id]);
    
    if (!Array.isArray(users) || users.length === 0 || users[0].status === 0) {
      return res.status(403).json({ 
        success: false,
        message: '用户不存在或已被禁用',
        error: '用户不存在或已被禁用' 
      });
    }

    const user = users[0];
    
    // 生成新的令牌
    const newToken = generateToken({ 
      id: user.id, 
      username: user.username, 
      email: user.email 
    });

    res.json({
      success: true,
      message: '令牌刷新成功',
      data: {
        token: newToken
      }
    });

  } catch (error) {
    logger.error('令牌刷新失败:', error);
    res.status(403).json({ 
      success: false,
      message: '令牌无效',
      error: '令牌无效' 
    });
  }
});

export default router;