import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateCompanyCreation, validateWorkflowExecution } from '../middleware/validation';
import { query, getConnection } from '../config/database';
import { redisClient } from '../config/redis';
import { kafkaProducer } from '../config/kafka';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { workflowQueue } from '../services/workflowQueue';
import { buildExecutionRequest } from '../services/workflowBuilder';

const router = Router();

// 创建公司
router.post('/', authenticate, validateCompanyCreation, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { name, description, maxEmployees, workflowType, initialCapital, workflowConfig } = req.body;
    const userId = req.user!.id;

    // 开始事务
    await connection.beginTransaction();

    // 检查用户是否已有公司
    const existingCompany = await connection.execute(
      'SELECT id FROM companies WHERE owner_id = ?',
      [userId]
    );

    if (Array.isArray(existingCompany[0]) && existingCompany[0].length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '您已经拥有一家公司，无法创建多家公司' 
      });
    }

    // 检查用户游戏币余额
    const userBalance = await connection.execute(
      'SELECT game_coins FROM users WHERE id = ?',
      [userId]
    );

    const currentBalance = userBalance[0][0]?.game_coins || 0;
    
    if (currentBalance < initialCapital) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '游戏币余额不足，无法创建公司' 
      });
    }

    // 创建公司
    const companyResult = await connection.execute(
      `INSERT INTO companies (owner_id, name, description, max_employees, 
        workflow_type, initial_capital, current_capital, status, workflow_config) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [userId, name, description, maxEmployees, workflowType, initialCapital, initialCapital, workflowConfig ? JSON.stringify(workflowConfig) : null]
    );

    const companyId = (companyResult[0] as any).insertId;

    // 扣除用户游戏币
    await connection.execute(
      'UPDATE users SET game_coins = game_coins - ? WHERE id = ?',
      [initialCapital, userId]
    );

    // 记录游戏币交易
    const balanceAfter = currentBalance - initialCapital;
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, 
        related_type, related_id) 
       VALUES (?, 'spend', ?, ?, '创建公司扣除初始资金', 'company', ?)`,
      [userId, initialCapital, balanceAfter, companyId]
    );

    await connection.commit();

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'company-events',
      messages: [{
        value: JSON.stringify({
          event: 'company_created',
          companyId,
          userId,
          name,
          maxEmployees,
          workflowType,
          timestamp: new Date().toISOString()
        })
      }]
    });

    // 清除用户相关的缓存
    await redisClient.del(`user:${userId}:companies`);
    await redisClient.del(`user:${userId}:balance`);

    logger.info(`用户 ${userId} 创建了公司 ${companyId}: ${name}`);

    res.json({
      success: true,
      message: '公司创建成功',
      data: {
        id: companyId,
        name,
        description,
        maxEmployees,
        workflowType,
        initialCapital,
        currentCapital: initialCapital,
        status: 'active',
        workflowConfig: workflowConfig || null
      }
    });

  } catch (error) {
    await connection.rollback();
    logger.error('创建公司失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建公司失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

router.post('/:companyId/execute', authenticate, validateWorkflowExecution, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const companyId = Number(req.params.companyId);
    const companies = await query<any[]>(
      'SELECT * FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
      [companyId, userId]
    );

    if (!companies.length) {
      return res.status(404).json({ success: false, message: '公司不存在或无权操作' });
    }

    const company = companies[0];
    const workflowConfig = company.workflow_config ? JSON.parse(company.workflow_config) : {};
    const employees = await query<any[]>(
      `SELECT ea.*
       FROM company_employees ce 
       JOIN employee_agents ea ON ce.employee_id = ea.id
       WHERE ce.company_id = ? AND ce.status = 'active'`,
      [companyId]
    );

    const executionPayload = buildExecutionRequest(company, employees, req.body, workflowConfig);
    const jobId = await workflowQueue.enqueue(companyId, userId, executionPayload);
    const job = await workflowQueue.getJob(jobId);
    const position = job?.position || 0;

    res.status(202).json({
      success: true,
      jobId,
      position,
      etaMs: job?.etaMs ?? workflowQueue.estimateWaitMs(position),
    });
  } catch (error) {
    logger.error('公司端触发workflow失败', error);
    res.status(500).json({ success: false, message: '触发workflow失败' });
  }
});

// 获取用户的公司列表
router.get('/my', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const cacheKey = `user:${userId}:companies`;

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    const companies = await query<any[]>(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM agents a 
         WHERE a.company_id = c.id AND a.status = 'employed') as current_employees
       FROM companies c 
       WHERE c.owner_id = ? 
       ORDER BY c.created_at DESC`,
      [userId]
    );

    const formatted = companies.map(company => ({
      ...company,
      workflow_config: company.workflow_config ? JSON.parse(company.workflow_config) : null
    }));

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(formatted)); // 5分钟缓存

    res.json({
      success: true,
      data: formatted
    });

  } catch (error) {
    logger.error('获取用户公司列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取公司列表失败' 
    });
  }
});

// 获取公司详情
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const cacheKey = `company:${id}`;

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      const company = JSON.parse(cachedData);
      // 检查权限
      if (company.owner_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: '无权访问此公司信息' 
        });
      }
      return res.json({
        success: true,
        data: company
      });
    }

    const companies = await query<any[]>(
      `SELECT c.*, u.username as owner_name,
        (SELECT COUNT(*) FROM company_employees ce 
         WHERE ce.company_id = c.id AND ce.status = 'active') as current_employees,
        (SELECT COUNT(*) FROM games g 
         WHERE g.company_id = c.id AND g.status = 'published') as published_games
       FROM companies c 
       JOIN users u ON c.owner_id = u.id 
       WHERE c.id = ?`,
      [id]
    );

    if (companies.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '公司不存在' 
      });
    }

    const company = {
      ...companies[0],
      workflow_config: companies[0].workflow_config ? JSON.parse(companies[0].workflow_config) : null
    };

    // 检查权限
    if (company.owner_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: '无权访问此公司信息' 
      });
    }

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(company)); // 5分钟缓存

    res.json({
      success: true,
      data: company
    });

  } catch (error) {
    logger.error('获取公司详情失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取公司详情失败' 
    });
  }
});

// 更新公司信息
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, description, workflowType, workflowConfig } = req.body;

    // 检查公司所有权
    const ownership = await query(
      'SELECT id FROM companies WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (ownership.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: '无权更新此公司信息' 
      });
    }

    const result = await query(
      `UPDATE companies 
       SET name = ?, description = ?, workflow_type = ?, workflow_config = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, description, workflowType, workflowConfig ? JSON.stringify(workflowConfig) : null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '公司不存在' 
      });
    }

    // 清除缓存
    await redisClient.del(`company:${id}`);
    await redisClient.del(`user:${userId}:companies`);

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'company-events',
      messages: [{
        value: JSON.stringify({
          event: 'company_updated',
          companyId: id,
          userId,
          name,
          workflowType,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 更新了公司 ${id} 的信息`);

    res.json({
      success: true,
      message: '公司信息更新成功'
    });

  } catch (error) {
    logger.error('更新公司信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新公司信息失败' 
    });
  }
});

// 解散公司
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 开始事务
    await connection.beginTransaction();

    // 检查公司所有权和状态
    const companyInfo = await connection.execute(
      'SELECT * FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
      [id, userId]
    );

    if (Array.isArray(companyInfo[0]) && companyInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '公司不存在或无权解散' 
      });
    }

    const company = companyInfo[0][0];

    // 检查是否有活跃的员工
    const activeEmployees = await connection.execute(
      'SELECT COUNT(*) as count FROM company_employees WHERE company_id = ? AND status = "active"',
      [id]
    );

    if (activeEmployees[0][0].count > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '公司还有活跃员工，无法解散，请先处理员工' 
      });
    }

    // 解散公司
    await connection.execute(
      'UPDATE companies SET status = "dissolved", updated_at = NOW() WHERE id = ?',
      [id]
    );

    // 返还剩余资金给用户
    await connection.execute(
      'UPDATE users SET game_coins = game_coins + ? WHERE id = ?',
      [company.current_capital, userId]
    );

    // 记录游戏币交易
    const userResult = await connection.execute('SELECT game_coins FROM users WHERE id = ?', [userId]);
    const newBalance = (userResult[0][0]?.game_coins || 0) + company.current_capital;
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, 
        related_type, related_id) 
       VALUES (?, 'earn', ?, ?, '公司解散返还剩余资金', 'company', ?)`,
      [userId, company.current_capital, newBalance, id]
    );

    await connection.commit();

    // 清除缓存
    await redisClient.del(`company:${id}`);
    await redisClient.del(`user:${userId}:companies`);
    await redisClient.del(`user:${userId}:balance`);

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'company-events',
      messages: [{
        value: JSON.stringify({
          event: 'company_dissolved',
          companyId: id,
          userId,
          returnedCapital: company.current_capital,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 解散了公司 ${id}: ${company.name}`);

    res.json({
      success: true,
      message: '公司解散成功',
      data: {
        returnedCapital: company.current_capital
      }
    });

  } catch (error) {
    await connection.rollback();
    logger.error('解散公司失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '解散公司失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 获取公司员工列表
router.get('/:id/employees', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 检查公司所有权
    const ownership = await query(
      'SELECT id FROM companies WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (ownership.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: '无权访问此公司员工信息' 
      });
    }

    const employees = await query<any[]>(
      `SELECT a.* 
       FROM agents a
       WHERE a.company_id = ? AND a.status = 'employed'
       ORDER BY a.type, a.id`,
      [id]
    );

    res.json({
      success: true,
      data: employees
    });

  } catch (error) {
    logger.error('获取公司员工列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取公司员工列表失败' 
    });
  }
});

// 向公司注资
router.post('/:id/inject-funds', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '注资金额必须大于0'
      });
    }

    await connection.beginTransaction();

    // 检查公司所有权和状态
    const companyInfo = await connection.execute(
      'SELECT * FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
      [id, userId]
    );

    if (Array.isArray(companyInfo[0]) && companyInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '公司不存在或无权操作' 
      });
    }

    // 检查用户游戏币余额
    const userBalance = await connection.execute(
      'SELECT game_coins FROM users WHERE id = ?',
      [userId]
    );

    const currentBalance = userBalance[0][0]?.game_coins || 0;
    
    if (currentBalance < amount) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '游戏币余额不足' 
      });
    }

    // 扣除用户游戏币
    await connection.execute(
      'UPDATE users SET game_coins = game_coins - ? WHERE id = ?',
      [amount, userId]
    );

    // 增加公司资金
    await connection.execute(
      'UPDATE companies SET current_capital = current_capital + ?, updated_at = NOW() WHERE id = ?',
      [amount, id]
    );

    // 记录交易
    const balanceAfter = currentBalance - amount;
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, 
        related_type, related_id) 
       VALUES (?, 'spend', ?, ?, '向公司注资', 'company', ?)`,
      [userId, amount, balanceAfter, id]
    );

    await connection.commit();

    // 清除缓存
    await redisClient.del(`company:${id}`);
    await redisClient.del(`user:${userId}:companies`);
    await redisClient.del(`user:${userId}:balance`);

    logger.info(`用户 ${userId} 向公司 ${id} 注资 ${amount} 游戏币`);

    res.json({
      success: true,
      message: '注资成功'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('注资失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '注资失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 获取公司统计信息
router.get('/:id/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 检查公司所有权
    const ownership = await query(
      'SELECT id FROM companies WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (ownership.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: '无权访问此公司统计信息' 
      });
    }

    const stats = await query(
      `SELECT 
         (SELECT COUNT(*) FROM company_employees 
          WHERE company_id = ? AND status = 'active') as total_employees,
         (SELECT COUNT(*) FROM games 
          WHERE company_id = ?) as total_games,
         (SELECT COUNT(*) FROM games 
          WHERE company_id = ? AND status = 'published') as published_games,
         (SELECT COUNT(*) FROM games 
          WHERE company_id = ? AND status = 'developing') as developing_games,
         (SELECT AVG(rating) FROM games 
          WHERE company_id = ? AND rating IS NOT NULL) as avg_rating,
         (SELECT SUM(downloads) FROM games 
          WHERE company_id = ?) as total_downloads`,
      [id, id, id, id, id, id]
    );

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    logger.error('获取公司统计信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取公司统计信息失败' 
    });
  }
});

export default router;