import { Router } from 'express';
import { query, getConnection } from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { sendMessage } from '../config/kafka';
import logger from '../utils/logger';

const router = Router();

// 获取用户游戏币余额
router.get('/balance', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const users = await query(
      'SELECT game_coins FROM users WHERE id = ?',
      [userId]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      balance: users[0].game_coins
    });

  } catch (error) {
    logger.error('获取游戏币余额失败:', error);
    res.status(500).json({ error: '获取游戏币余额失败' });
  }
});

// 获取游戏币交易记录
router.get('/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { limit = 20, offset = 0, type } = req.query;

    let sql = `
      SELECT 
        id, transaction_type, amount, balance_after, description,
        related_id, related_type, created_at
      FROM coin_transactions 
      WHERE user_id = ?
    `;
    
    const params: any[] = [userId];

    if (type) {
      sql += ' AND transaction_type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const transactions = await query(sql, params);

    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM coin_transactions WHERE user_id = ?';
    const countParams: any[] = [userId];
    
    if (type) {
      countSql += ' AND transaction_type = ?';
      countParams.push(type);
    }

    const totalResult = await query(countSql, countParams);
    const total = totalResult[0].total;

    res.json({
      transactions,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    logger.error('获取交易记录失败:', error);
    res.status(500).json({ error: '获取交易记录失败' });
  }
});

// 游戏币转账（用户之间）
router.post('/transfer', authenticateToken, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const fromUserId = req.user!.id;
    const { to_username, amount, description } = req.body;

    if (!to_username || !amount || amount <= 0) {
      return res.status(400).json({ error: '参数错误' });
    }

    // 开始事务
    await connection.beginTransaction();

    // 获取发送方用户信息
    const fromUsers = await connection.execute(
      'SELECT game_coins FROM users WHERE id = ? FOR UPDATE',
      [fromUserId]
    );

    if (!Array.isArray(fromUsers[0]) || fromUsers[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '发送方用户不存在' });
    }

    const fromUserBalance = fromUsers[0][0].game_coins;

    if (fromUserBalance < amount) {
      await connection.rollback();
      return res.status(400).json({ error: '游戏币余额不足' });
    }

    // 获取接收方用户信息
    const toUsers = await connection.execute(
      'SELECT id, username, game_coins FROM users WHERE username = ? FOR UPDATE',
      [to_username]
    );

    if (!Array.isArray(toUsers[0]) || toUsers[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '接收方用户不存在' });
    }

    const toUser = toUsers[0][0];
    const toUserId = toUser.id;

    if (fromUserId === toUserId) {
      await connection.rollback();
      return res.status(400).json({ error: '不能向自己转账' });
    }

    // 扣除发送方游戏币
    const newFromBalance = fromUserBalance - amount;
    await connection.execute(
      'UPDATE users SET game_coins = ? WHERE id = ?',
      [newFromBalance, fromUserId]
    );

    // 增加接收方游戏币
    const newToBalance = toUser.game_coins + amount;
    await connection.execute(
      'UPDATE users SET game_coins = ? WHERE id = ?',
      [newToBalance, toUserId]
    );

    // 记录发送方交易
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, related_id, related_type)
       VALUES (?, 'spend', ?, ?, ?, ?, 'user')`,
      [fromUserId, amount, newFromBalance, description || `转账给 ${to_username}`, toUserId]
    );

    // 记录接收方交易
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, related_id, related_type)
       VALUES (?, 'earn', ?, ?, ?, ?, 'user')`,
      [toUserId, amount, newToBalance, description || `收到来自 ${req.user!.username} 的转账`, fromUserId]
    );

    // 提交事务
    await connection.commit();

    // 发送转账事件到Kafka
    await sendMessage('market-events', {
      type: 'coin_transfer',
      fromUserId,
      toUserId,
      amount,
      description: description || `转账给 ${to_username}`,
      timestamp: new Date().toISOString()
    });

    logger.info(`游戏币转账成功: ${req.user!.username} -> ${to_username}, amount=${amount}`);

    res.json({
      message: '转账成功',
      new_balance: newFromBalance
    });

  } catch (error) {
    await connection.rollback();
    logger.error('游戏币转账失败:', error);
    res.status(500).json({ error: '转账失败' });
  } finally {
    connection.release();
  }
});

// 游戏币充值（模拟）
router.post('/recharge', authenticateToken, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const userId = req.user!.id;
    const { amount, payment_method } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: '充值金额必须大于0' });
    }

    // 开始事务
    await connection.beginTransaction();

    // 获取用户当前余额
    const users = await connection.execute(
      'SELECT game_coins FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );

    if (!Array.isArray(users[0]) || users[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '用户不存在' });
    }

    const currentBalance = users[0][0].game_coins;
    const newBalance = currentBalance + amount;

    // 更新用户余额
    await connection.execute(
      'UPDATE users SET game_coins = ? WHERE id = ?',
      [newBalance, userId]
    );

    // 记录交易
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, related_type)
       VALUES (?, 'earn', ?, ?, ?, 'system')`,
      [userId, amount, newBalance, `游戏币充值 - ${payment_method || '系统充值'}`]
    );

    // 提交事务
    await connection.commit();

    // 发送充值事件到Kafka
    await sendMessage('market-events', {
      type: 'coin_recharge',
      userId,
      amount,
      payment_method: payment_method || 'system',
      timestamp: new Date().toISOString()
    });

    logger.info(`游戏币充值成功: userId=${userId}, amount=${amount}`);

    res.json({
      message: '充值成功',
      new_balance: newBalance
    });

  } catch (error) {
    await connection.rollback();
    logger.error('游戏币充值失败:', error);
    res.status(500).json({ error: '充值失败' });
  } finally {
    connection.release();
  }
});

// 获取游戏币统计信息
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const stats = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        SUM(CASE WHEN transaction_type = 'earn' THEN amount ELSE 0 END) as total_earned,
        SUM(CASE WHEN transaction_type = 'spend' THEN amount ELSE 0 END) as total_spent,
        AVG(CASE WHEN transaction_type = 'earn' THEN amount END) as avg_earn,
        AVG(CASE WHEN transaction_type = 'spend' THEN amount END) as avg_spend,
        MIN(created_at) as first_transaction_date,
        MAX(created_at) as last_transaction_date
      FROM coin_transactions 
      WHERE user_id = ?
    `, [userId]);

    res.json({
      stats: stats[0] || {
        total_transactions: 0,
        total_earned: 0,
        total_spent: 0,
        avg_earn: 0,
        avg_spend: 0,
        first_transaction_date: null,
        last_transaction_date: null
      }
    });

  } catch (error) {
    logger.error('获取游戏币统计信息失败:', error);
    res.status(500).json({ error: '获取游戏币统计信息失败' });
  }
});

export default router;