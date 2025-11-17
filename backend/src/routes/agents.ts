import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateAgentCreation, validateAgentUpdate } from '../middleware/validation';
import { query, getConnection } from '../config/database';
import { redisClient } from '../config/redis';
import { kafkaProducer } from '../config/kafka';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// 创建员工Agent
router.post('/', authenticate, validateAgentCreation, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { 
      name, 
      type, 
      specialization, 
      skills, 
      experience, 
      education, 
      traits, 
      salaryRequirement,
      companyId 
    } = req.body;
    
    const userId = req.user!.id;

    // 开始事务
    await connection.beginTransaction();

    // 检查用户是否有所属公司
    if (companyId) {
      const companyOwnership = await connection.execute(
        'SELECT id FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
        [companyId, userId]
      );

      if (Array.isArray(companyOwnership[0]) && companyOwnership[0].length === 0) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: '无权在此公司创建员工' 
        });
      }

      // 检查公司是否已满员
      const employeeCount = await connection.execute(
        'SELECT COUNT(*) as count FROM company_employees WHERE company_id = ? AND status = "active"',
        [companyId]
      );

      const companyInfo = await connection.execute(
        'SELECT max_employees FROM companies WHERE id = ?',
        [companyId]
      );

      if (employeeCount[0][0].count >= companyInfo[0][0].max_employees) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false, 
          message: '公司已达到最大员工数量限制' 
        });
      }
    }

    // 检查用户游戏币余额（创建员工需要费用）
    const creationCost = salaryRequirement; // 创建成本等于薪资要求
    const userBalance = await connection.execute(
      'SELECT balance FROM user_coins WHERE user_id = ?',
      [userId]
    );

    const currentBalance = userBalance[0][0]?.balance || 0;
    
    if (currentBalance < creationCost) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '游戏币余额不足，无法创建员工' 
      });
    }

    // 创建员工Agent
    const agentResult = await connection.execute(
      `INSERT INTO employee_agents (
        owner_id, name, type, specialization, skills, experience, 
        education, traits, salary_requirement, status, created_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'user')`,
      [userId, name, type, specialization, JSON.stringify(skills), experience, 
       education, JSON.stringify(traits), salaryRequirement]
    );

    const agentId = (agentResult[0] as any).insertId;

    // 如果指定了公司，添加到公司
    if (companyId) {
      await connection.execute(
        `INSERT INTO company_employees (company_id, employee_id, position, salary, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [companyId, agentId, type, salaryRequirement]
      );
    }

    // 扣除用户游戏币
    await connection.execute(
      'UPDATE user_coins SET balance = balance - ? WHERE user_id = ?',
      [creationCost, userId]
    );

    // 记录游戏币交易
    await connection.execute(
      `INSERT INTO coin_transactions (user_id, type, amount, description, 
        related_entity_type, related_entity_id) 
       VALUES (?, 'agent_creation', -?, '创建员工Agent', 'employee_agent', ?)`,
      [userId, creationCost, agentId]
    );

    await connection.commit();

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'agent-events',
      messages: [{
        value: JSON.stringify({
          event: 'agent_created',
          agentId,
          userId,
          name,
          type,
          specialization,
          companyId,
          timestamp: new Date().toISOString()
        })
      }]
    });

    // 清除相关缓存
    await redisClient.del(`user:${userId}:agents`);
    await redisClient.del(`user:${userId}:balance`);
    if (companyId) {
      await redisClient.del(`company:${companyId}:employees`);
    }

    logger.info(`用户 ${userId} 创建了员工Agent ${agentId}: ${name}`);

    res.json({
      success: true,
      message: '员工Agent创建成功',
      data: {
        id: agentId,
        name,
        type,
        specialization,
        skills,
        experience,
        education,
        traits,
        salaryRequirement,
        companyId,
        status: 'active'
      }
    });

  } catch (error) {
    await connection.rollback();
    logger.error('创建员工Agent失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '创建员工Agent失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 获取用户的员工Agent列表
router.get('/my', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { status = 'all', type } = req.query;
    const cacheKey = `user:${userId}:agents:${status}:${type || 'all'}`;

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: JSON.parse(cachedData)
      });
    }

    let queryStr = `
      SELECT ea.*, c.name as company_name, ce.company_id
      FROM employee_agents ea
      LEFT JOIN company_employees ce ON ea.id = ce.employee_id AND ce.status = 'active'
      LEFT JOIN companies c ON ce.company_id = c.id
      WHERE ea.owner_id = ?
    `;
    
    const params: any[] = [userId];

    if (status !== 'all') {
      queryStr += ' AND ea.status = ?';
      params.push(status);
    }

    if (type) {
      queryStr += ' AND ea.type = ?';
      params.push(type);
    }

    queryStr += ' ORDER BY ea.created_at DESC';

    const agents = await query(queryStr, params);

    // 解析JSON字段
    const formattedAgents = agents.map(agent => ({
      ...agent,
      skills: agent.skills ? JSON.parse(agent.skills) : [],
      traits: agent.traits ? JSON.parse(agent.traits) : []
    }));

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(formattedAgents)); // 5分钟缓存

    res.json({
      success: true,
      data: formattedAgents
    });

  } catch (error) {
    logger.error('获取员工Agent列表失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取员工Agent列表失败' 
    });
  }
});

// 获取员工Agent详情
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const cacheKey = `agent:${id}`;

    // 尝试从缓存获取
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      const agent = JSON.parse(cachedData);
      // 检查权限
      if (agent.owner_id !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: '无权访问此员工信息' 
        });
      }
      return res.json({
        success: true,
        data: agent
      });
    }

    const agents = await query(
      `SELECT ea.*, c.name as company_name, ce.company_id, ce.position, ce.salary
       FROM employee_agents ea
       LEFT JOIN company_employees ce ON ea.id = ce.employee_id AND ce.status = 'active'
       LEFT JOIN companies c ON ce.company_id = c.id
       WHERE ea.id = ?`,
      [id]
    );

    if (agents.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '员工Agent不存在' 
      });
    }

    const agent = agents[0];

    // 检查权限
    if (agent.owner_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: '无权访问此员工信息' 
      });
    }

    // 解析JSON字段
    const formattedAgent = {
      ...agent,
      skills: agent.skills ? JSON.parse(agent.skills) : [],
      traits: agent.traits ? JSON.parse(agent.traits) : []
    };

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(formattedAgent)); // 5分钟缓存

    res.json({
      success: true,
      data: formattedAgent
    });

  } catch (error) {
    logger.error('获取员工Agent详情失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取员工Agent详情失败' 
    });
  }
});

// 更新员工Agent信息
router.put('/:id', authenticate, validateAgentUpdate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, specialization, skills, traits, salaryRequirement } = req.body;

    // 检查员工所有权
    const ownership = await query(
      'SELECT id FROM employee_agents WHERE id = ? AND owner_id = ? AND status = "active"',
      [id, userId]
    );

    if (ownership.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: '无权更新此员工信息或员工不存在' 
      });
    }

    const result = await query(
      `UPDATE employee_agents 
       SET name = ?, specialization = ?, skills = ?, traits = ?, 
           salary_requirement = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, specialization, JSON.stringify(skills), JSON.stringify(traits), 
       salaryRequirement, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '员工Agent不存在' 
      });
    }

    // 清除缓存
    await redisClient.del(`agent:${id}`);
    await redisClient.del(`user:${userId}:agents`);

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'agent-events',
      messages: [{
        value: JSON.stringify({
          event: 'agent_updated',
          agentId: id,
          userId,
          name,
          specialization,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 更新了员工Agent ${id} 的信息`);

    res.json({
      success: true,
      message: '员工Agent信息更新成功'
    });

  } catch (error) {
    logger.error('更新员工Agent信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '更新员工Agent信息失败' 
    });
  }
});

// 解雇员工Agent
router.post('/:id/fire', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 开始事务
    await connection.beginTransaction();

    // 检查员工所有权
    const agentInfo = await connection.execute(
      'SELECT * FROM employee_agents WHERE id = ? AND owner_id = ? AND status = "active"',
      [id, userId]
    );

    if (Array.isArray(agentInfo[0]) && agentInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '员工Agent不存在或无权解雇' 
      });
    }

    // 解雇员工
    await connection.execute(
      'UPDATE employee_agents SET status = "fired", updated_at = NOW() WHERE id = ?',
      [id]
    );

    // 从公司中移除
    await connection.execute(
      'UPDATE company_employees SET status = "inactive", end_date = NOW() WHERE employee_id = ? AND status = "active"',
      [id]
    );

    await connection.commit();

    // 清除缓存
    await redisClient.del(`agent:${id}`);
    await redisClient.del(`user:${userId}:agents`);

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'agent-events',
      messages: [{
        value: JSON.stringify({
          event: 'agent_fired',
          agentId: id,
          userId,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 解雇了员工Agent ${id}`);

    res.json({
      success: true,
      message: '员工Agent解雇成功'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('解雇员工Agent失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '解雇员工Agent失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 将员工Agent放到市场出售
router.post('/:id/sell', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { price, description } = req.body;

    // 开始事务
    await connection.beginTransaction();

    // 检查员工所有权
    const agentInfo = await connection.execute(
      'SELECT * FROM employee_agents WHERE id = ? AND owner_id = ? AND status = "active"',
      [id, userId]
    );

    if (Array.isArray(agentInfo[0]) && agentInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '员工Agent不存在或无权出售' 
      });
    }

    // 检查是否已在市场中
    const existingMarket = await connection.execute(
      'SELECT id FROM market_listings WHERE employee_id = ? AND status = "active"',
      [id]
    );

    if (Array.isArray(existingMarket[0]) && existingMarket[0].length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '该员工已在市场中出售' 
      });
    }

    // 从公司中移除（如果在公司中）
    await connection.execute(
      'UPDATE company_employees SET status = "inactive", end_date = NOW() WHERE employee_id = ? AND status = "active"',
      [id]
    );

    // 创建市场列表
    await connection.execute(
      `INSERT INTO market_listings (seller_id, employee_id, price, description, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [userId, id, price, description]
    );

    // 更新员工状态
    await connection.execute(
      'UPDATE employee_agents SET status = "on_sale", updated_at = NOW() WHERE id = ?',
      [id]
    );

    await connection.commit();

    // 清除缓存
    await redisClient.del(`agent:${id}`);
    await redisClient.del(`user:${userId}:agents`);

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'market-events',
      messages: [{
        value: JSON.stringify({
          event: 'agent_listed',
          agentId: id,
          userId,
          price,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 将员工Agent ${id} 放到市场出售，价格: ${price}`);

    res.json({
      success: true,
      message: '员工Agent已放到市场出售'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('出售员工Agent失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '出售员工Agent失败，请稍后重试' 
    });
  } finally {
    connection.release();
  }
});

// 获取员工Agent统计信息
router.get('/stats/overview', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const stats = await query(
      `SELECT 
         (SELECT COUNT(*) FROM employee_agents 
          WHERE owner_id = ? AND status = 'active') as total_agents,
         (SELECT COUNT(*) FROM employee_agents 
          WHERE owner_id = ? AND status = 'on_sale') as selling_agents,
         (SELECT COUNT(*) FROM employee_agents 
          WHERE owner_id = ? AND status = 'fired') as fired_agents,
         (SELECT COUNT(*) FROM employee_agents 
          WHERE owner_id = ? AND type = 'planner') as planner_agents,
         (SELECT COUNT(*) FROM employee_agents 
          WHERE owner_id = ? AND type = 'artist') as artist_agents,
         (SELECT COUNT(*) FROM employee_agents 
          WHERE owner_id = ? AND type = 'developer') as developer_agents,
         (SELECT COUNT(*) FROM employee_agents 
          WHERE owner_id = ? AND type = 'tester') as tester_agents,
         (SELECT COUNT(*) FROM employee_agents 
          WHERE owner_id = ? AND type = 'operator') as operator_agents`,
      [userId, userId, userId, userId, userId, userId, userId, userId]
    );

    res.json({
      success: true,
      data: stats[0]
    });

  } catch (error) {
    logger.error('获取员工Agent统计信息失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取员工Agent统计信息失败' 
    });
  }
});

export default router;