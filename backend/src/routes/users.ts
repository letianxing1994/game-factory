import { Router } from 'express';
import { query } from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { hashPassword } from '../utils/password';
import { sendMessage } from '../config/kafka';
import logger from '../utils/logger';

const router = Router();

// 获取用户信息
router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    
    const users = await query(
      `SELECT id, username, email, avatar_url, game_coins, reputation, status, created_at 
       FROM users WHERE id = ?`, 
      [userId]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];
    
    // 获取用户的公司数量
    const companyCount = await query(
      'SELECT COUNT(*) as count FROM companies WHERE owner_id = ?',
      [userId]
    );

    // 获取用户的员工数量
    const agentCount = await query(
      'SELECT COUNT(*) as count FROM agents WHERE owner_id = ?',
      [userId]
    );

    res.json({
      user: {
        ...user,
        company_count: companyCount[0].count,
        agent_count: agentCount[0].count
      }
    });

  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新用户信息
router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { avatar_url } = req.body;

    if (!avatar_url) {
      return res.status(400).json({ error: '请提供要更新的信息' });
    }

    await query(
      'UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [avatar_url, userId]
    );

    // 发送用户信息更新事件
    await sendMessage('user-events', {
      type: 'user_profile_updated',
      userId,
      avatar_url,
      updated_at: new Date().toISOString()
    });

    logger.info(`用户资料更新成功: userId=${userId}`);

    res.json({ message: '用户信息更新成功' });

  } catch (error) {
    logger.error('更新用户信息失败:', error);
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

// 修改密码
router.put('/password', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: '请提供当前密码和新密码' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: '新密码长度至少为6个字符' });
    }

    // 验证当前密码
    const users = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!Array.isArray(users) || users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const { comparePassword } = await import('../utils/password');
    const isCurrentPasswordValid = await comparePassword(current_password, users[0].password_hash);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: '当前密码错误' });
    }

    // 更新密码
    const newPasswordHash = await hashPassword(new_password);
    await query(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newPasswordHash, userId]
    );

    // 发送密码修改事件
    await sendMessage('user-events', {
      type: 'user_password_changed',
      userId,
      changed_at: new Date().toISOString()
    });

    logger.info(`用户密码修改成功: userId=${userId}`);

    res.json({ message: '密码修改成功' });

  } catch (error) {
    logger.error('修改密码失败:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

// 获取用户统计信息
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // 获取用户基本统计
    const [userStats, companyStats, agentStats, transactionStats] = await Promise.all([
      // 用户基本信息
      query('SELECT game_coins, reputation FROM users WHERE id = ?', [userId]),
      
      // 公司统计
      query(`
        SELECT 
          COUNT(*) as total_companies,
          SUM(current_capital) as total_capital,
          AVG(current_capital) as avg_capital
        FROM companies 
        WHERE owner_id = ?
      `, [userId]),
      
      // 员工统计
      query(`
        SELECT 
          COUNT(*) as total_agents,
          type,
          COUNT(*) as count
        FROM agents 
        WHERE owner_id = ?
        GROUP BY type
      `, [userId]),
      
      // 交易统计
      query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN transaction_type = 'earn' THEN amount ELSE 0 END) as total_earned,
          SUM(CASE WHEN transaction_type = 'spend' THEN amount ELSE 0 END) as total_spent
        FROM coin_transactions 
        WHERE user_id = ?
      `, [userId])
    ]);

    if (!Array.isArray(userStats) || userStats.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const stats = {
      user: userStats[0],
      companies: companyStats[0] || { total_companies: 0, total_capital: 0, avg_capital: 0 },
      agents: {
        total: agentStats.reduce((sum: number, stat: any) => sum + parseInt(stat.count), 0),
        by_type: agentStats
      },
      transactions: transactionStats[0] || { total_transactions: 0, total_earned: 0, total_spent: 0 }
    };

    res.json({ stats });

  } catch (error) {
    logger.error('获取用户统计信息失败:', error);
    res.status(500).json({ error: '获取用户统计信息失败' });
  }
});

// 获取用户活动历史
router.get('/activity', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { limit = 20, offset = 0 } = req.query;

    // 获取用户的各种活动记录
    const activities = await query(`
      (SELECT 'company_created' as type, created_at, name as description, id as reference_id
       FROM companies WHERE owner_id = ?)
      UNION ALL
      (SELECT 'agent_created' as type, created_at, name as description, id as reference_id
       FROM agents WHERE owner_id = ?)
      UNION ALL
      (SELECT transaction_type as type, created_at, description, id as reference_id
       FROM coin_transactions WHERE user_id = ?)
      UNION ALL
      (SELECT 'game_released' as type, released_at as created_at, name as description, id as reference_id
       FROM games WHERE company_id IN (SELECT id FROM companies WHERE owner_id = ?))
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, userId, userId, userId, parseInt(limit as string), parseInt(offset as string)]);

    res.json({ activities });

  } catch (error) {
    logger.error('获取用户活动历史失败:', error);
    res.status(500).json({ error: '获取用户活动历史失败' });
  }
});

export default router;