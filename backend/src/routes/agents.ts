import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { query, getConnection } from '../config/database';
import { redisClient } from '../config/redis';
import { kafkaProducer } from '../config/kafka';
import logger from '../utils/logger';
import { AuthRequest } from '../middleware/auth';
import { conversationalService } from '../services/conversationalService';

const router = Router();

// 创建员工Agent
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { 
      name, 
      type,
      dimension,
      ai_model,
      ai_model_2d,
      ai_model_3d,
      specialization,
      extra_traits,
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

      // 检查公司员工数量
      const employeeCount = await connection.execute(
        'SELECT COUNT(*) as count FROM agents WHERE company_id = ? AND status = "employed"',
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

    // 创建员工Agent
    const agentResult = await connection.execute(
      `INSERT INTO agents (
        owner_id, name, type, dimension, ai_model, ai_model_2d, ai_model_3d,
        specialization, extra_traits, company_id, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, 
        name, 
        type, 
        dimension || null,
        ai_model || null,
        ai_model_2d || null,
        ai_model_3d || null,
        specialization, 
        extra_traits || null,
        companyId || null, 
        companyId ? 'employed' : 'available'
      ]
    );

    const agentId = (agentResult[0] as any).insertId;

    // 不再扣除游戏币和记录交易（移除了薪资成本逻辑）

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
          dimension,
          ai_model,
          specialization,
          companyId,
          timestamp: new Date().toISOString()
        })
      }]
    });

    // 清除所有相关缓存（使用通配符模式）
    const keys = await redisClient.keys(`user:${userId}:agents:*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
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
        dimension,
        ai_model,
        specialization,
        extra_traits,
        companyId,
        status: companyId ? 'employed' : 'available'
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

// 对话式雇佣员工
router.post('/conversational-create', authenticate, async (req: AuthRequest, res) => {
  try {
    const { companyId, model, messages } = req.body;
    const userId = req.user!.id;

    if (!companyId || !model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数：companyId, model 和 messages',
      });
    }

    // 调用 LLM 服务
    const result = await conversationalService.processAgentCreation(model, messages);

    if (result.shouldExecute && result.functionCall) {
      // 解析函数参数并雇佣员工
      const args = JSON.parse(result.functionCall.arguments);
      const connection = await getConnection();

      try {
        await connection.beginTransaction();

        // 验证公司所有权
        const companyOwnership = await connection.execute(
          'SELECT id, max_employees FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
          [companyId, userId]
        );

        if (Array.isArray(companyOwnership[0]) && companyOwnership[0].length === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            reply: '无权在此公司雇佣员工。',
          });
        }

        const company = companyOwnership[0][0];

        // 检查员工数量限制
        const employeeCount = await connection.execute(
          'SELECT COUNT(*) as count FROM agents WHERE company_id = ? AND status = "employed"',
          [companyId]
        );

        const currentCount = employeeCount[0][0]?.count || 0;

        if (currentCount >= company.max_employees) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            reply: `公司员工数已达上限 (${company.max_employees})，无法继续雇佣。`,
          });
        }

        // 创建员工
        const agentResult = await connection.execute(
          `INSERT INTO agents (name, type, dimension, owner_id, company_id, ai_model, specialization, extra_traits, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'employed')`,
          [
            args.name,
            args.type,
            args.dimension,
            userId,
            companyId,
            args.ai_model,
            args.specialization,
            args.extra_traits || null,
          ]
        );

        const agentId = (agentResult[0] as any).insertId;

        await connection.commit();

        // 发送Kafka消息
        await kafkaProducer.send({
          topic: 'agent-events',
          messages: [
            {
              value: JSON.stringify({
                event: 'agent_hired',
                agentId,
                companyId,
                userId,
                name: args.name,
                type: args.type,
                timestamp: new Date().toISOString(),
              }),
            },
          ],
        });

        // 清除缓存
        await redisClient.del(`user:${userId}:agents:all:all`);
        await redisClient.del(`company:${companyId}:employees`);

        logger.info(`用户 ${userId} 通过对话为公司 ${companyId} 雇佣了员工 ${agentId}: ${args.name}`);

        res.json({
          success: true,
          agentId,
          functionCall: result.functionCall,
          reply: `员工"${args.name}"雇佣成功！`,
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } else {
      // 返回 LLM 的回复，继续对话
      res.json({
        success: true,
        reply: result.reply,
      });
    }
  } catch (error: any) {
    logger.error('对话式雇佣员工失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '对话式雇佣失败',
    });
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
      SELECT a.*, c.name as company_name
      FROM agents a
      LEFT JOIN companies c ON a.company_id = c.id
      WHERE a.owner_id = ?
    `;
    
    const params: any[] = [userId];

    if (status !== 'all') {
      queryStr += ' AND a.status = ?';
      params.push(status);
    }

    if (type) {
      queryStr += ' AND a.type = ?';
      params.push(type);
    }

    queryStr += ' ORDER BY a.created_at DESC';

    const agents = await query(queryStr, params);

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(agents)); // 5分钟缓存

    res.json({
      success: true,
      data: agents
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
      `SELECT a.*, c.name as company_name
       FROM agents a
       LEFT JOIN companies c ON a.company_id = c.id
       WHERE a.id = ?`,
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

    // 缓存数据
    await redisClient.setEx(cacheKey, 300, JSON.stringify(agent)); // 5分钟缓存

    res.json({
      success: true,
      data: agent
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
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, ai_model, specialization, extra_traits } = req.body;

    // 检查员工所有权
    const ownership = await query(
      'SELECT id FROM agents WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (ownership.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: '无权更新此员工信息或员工不存在' 
      });
    }

    const result = await query(
      `UPDATE agents 
       SET name = ?, ai_model = ?, specialization = ?, 
           extra_traits = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, ai_model || null, specialization, 
       extra_traits || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        message: '员工Agent不存在' 
      });
    }

    // 清除所有相关缓存
    await redisClient.del(`agent:${id}`);
    const keys = await redisClient.keys(`user:${userId}:agents:*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

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

// 删除员工Agent
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // 开始事务
    await connection.beginTransaction();

    // 检查员工所有权
    const agentInfo = await connection.execute(
      'SELECT * FROM agents WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (Array.isArray(agentInfo[0]) && agentInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '员工Agent不存在或无权删除' 
      });
    }

    const agent = (agentInfo[0] as any[])[0];

    // 如果员工在公司中，需要先从公司移除
    if (agent.company_id) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '请先解雇该员工后再删除' 
      });
    }

    // 删除员工
    await connection.execute(
      'DELETE FROM agents WHERE id = ?',
      [id]
    );

    await connection.commit();

    // 清除所有相关缓存
    await redisClient.del(`agent:${id}`);
    const keys = await redisClient.keys(`user:${userId}:agents:*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

    // 发送Kafka消息
    await kafkaProducer.send({
      topic: 'agent-events',
      messages: [{
        value: JSON.stringify({
          event: 'agent_deleted',
          agentId: id,
          userId,
          timestamp: new Date().toISOString()
        })
      }]
    });

    logger.info(`用户 ${userId} 删除了员工Agent ${id}`);

    res.json({
      success: true,
      message: '员工Agent删除成功'
    });

  } catch (error) {
    await connection.rollback();
    logger.error('删除员工Agent失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '删除员工Agent失败，请稍后重试' 
    });
  } finally {
    connection.release();
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
      'SELECT * FROM agents WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (Array.isArray(agentInfo[0]) && agentInfo[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '员工Agent不存在或无权解雇' 
      });
    }

    // 解雇员工 - 设置为可用状态并移除公司关联
    await connection.execute(
      'UPDATE agents SET status = "available", company_id = NULL, updated_at = NOW() WHERE id = ?',
      [id]
    );

    await connection.commit();

    // 清除所有相关缓存
    await redisClient.del(`agent:${id}`);
    const keys = await redisClient.keys(`user:${userId}:agents:*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }

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

// 将员工分配到公司
router.post('/:id/assign', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { company_id } = req.body;

    if (!company_id) {
      return res.status(400).json({ 
        success: false, 
        message: '请指定目标公司' 
      });
    }

    // 开始事务
    await connection.beginTransaction();

    // 检查员工所有权和状态
    const [agentRows] = await connection.execute<any[]>(
      'SELECT * FROM agents WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (agentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '员工不存在或无权分配' 
      });
    }

    const agent = agentRows[0];

    // 检查员工是否已被雇佣
    if (agent.status === 'employed' && agent.company_id) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '该员工已在其他公司任职' 
      });
    }

    // 检查公司所有权和状态
    const [companyRows] = await connection.execute<any[]>(
      'SELECT * FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
      [company_id, userId]
    );

    if (companyRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false, 
        message: '公司不存在或无权操作' 
      });
    }

    const company = companyRows[0];

    // 检查公司员工人数限制
    const [countRows] = await connection.execute<any[]>(
      'SELECT COUNT(*) as count FROM agents WHERE company_id = ? AND status = "employed"',
      [company_id]
    );

    const currentCount = countRows[0].count;
    if (currentCount >= company.max_employees) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: `公司「${company.name}」已达到员工上限（${company.max_employees}人）` 
      });
    }

    // 更新员工的公司和状态
    await connection.execute(
      'UPDATE agents SET company_id = ?, status = "employed", updated_at = NOW() WHERE id = ?',
      [company_id, id]
    );

    // 清除相关缓存
    await redisClient.del(`user:${userId}:agents`);
    await redisClient.del(`company:${company_id}:agents`);
    await redisClient.del(`user:${userId}:companies`);

    await connection.commit();

    res.json({ 
      success: true, 
      message: `已将员工分配到公司「${company.name}」` 
    });

  } catch (error) {
    await connection.rollback();
    logger.error('分配员工到公司失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '分配员工失败' 
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
      'SELECT * FROM agents WHERE id = ? AND owner_id = ?',
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
      'SELECT id FROM market_transactions WHERE agent_id = ? AND status = "active"',
      [id]
    );

    if (Array.isArray(existingMarket[0]) && existingMarket[0].length > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false, 
        message: '该员工已在市场中出售' 
      });
    }

    // 创建市场交易
    await connection.execute(
      `INSERT INTO market_transactions (seller_id, agent_id, price, transaction_type, status)
       VALUES (?, ?, ?, 'sell', 'active')`,
      [userId, id, price]
    );

    // 更新员工状态为市场中，并移除公司关联
    await connection.execute(
      'UPDATE agents SET status = "available", is_on_market = TRUE, market_price = ?, company_id = NULL, updated_at = NOW() WHERE id = ?',
      [price, id]
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
         (SELECT COUNT(*) FROM agents 
          WHERE owner_id = ?) as total_agents,
         (SELECT COUNT(*) FROM agents 
          WHERE owner_id = ? AND is_on_market = TRUE) as selling_agents,
         (SELECT COUNT(*) FROM agents 
          WHERE owner_id = ? AND status = 'available') as available_agents,
         (SELECT COUNT(*) FROM agents 
          WHERE owner_id = ? AND type = 'planner') as planner_agents,
         (SELECT COUNT(*) FROM agents 
          WHERE owner_id = ? AND type = 'artist') as artist_agents,
         (SELECT COUNT(*) FROM agents 
          WHERE owner_id = ? AND type = 'developer') as developer_agents,
         (SELECT COUNT(*) FROM agents 
          WHERE owner_id = ? AND type = 'tester') as tester_agents,
         (SELECT COUNT(*) FROM agents 
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

// 对话式创建员工（流式输出）
router.post('/conversational', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message, model = 'gpt-4o', conversationHistory = [], companyId } = req.body;
    const userId = req.user!.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: '消息不能为空' });
    }

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: message }
    ];

    let fullResponse = '';
    let functionCall: any = null;

    try {
      for await (const chunk of conversationalService.processAgentCreationStream(model, messages)) {
        if (chunk.type === 'token' && chunk.content) {
          fullResponse += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'function_call' && chunk.functionCall) {
          functionCall = chunk.functionCall;
        } else if (chunk.type === 'done') {
          // 如果有函数调用，执行创建操作
          if (functionCall) {
            const args = JSON.parse(functionCall.arguments);
            const connection = await getConnection();
            
            try {
              await connection.beginTransaction();

              if (companyId) {
                const companyOwnership = await connection.execute(
                  'SELECT id, max_employees FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
                  [companyId, userId]
                );

                if (Array.isArray(companyOwnership[0]) && companyOwnership[0].length === 0) {
                  await connection.rollback();
                  res.write(`data: ${JSON.stringify({ type: 'error', content: '无权在此公司创建员工' })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  return res.end();
                }

                const employeeCount = await connection.execute(
                  'SELECT COUNT(*) as count FROM agents WHERE company_id = ? AND status = "employed"',
                  [companyId]
                );

                if (employeeCount[0][0].count >= companyOwnership[0][0].max_employees) {
                  await connection.rollback();
                  res.write(`data: ${JSON.stringify({ type: 'error', content: '公司已达到最大员工数量限制' })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  return res.end();
                }
              }

              const agentResult = await connection.execute(
                `INSERT INTO agents (owner_id, name, type, dimension, ai_model, specialization, extra_traits, company_id, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  userId, args.name, args.type, args.dimension || null, args.ai_model, args.specialization, 
                  args.extra_traits || null, companyId || null, companyId ? 'employed' : 'available'
                ]
              );

              const agentId = (agentResult[0] as any).insertId;
              await connection.commit();

              res.write(`data: ${JSON.stringify({ 
                type: 'success', 
                content: `✅ 员工「${args.name}」雇佣成功！`,
                agentId
              })}\n\n`);
            } catch (error) {
              await connection.rollback();
              logger.error('创建员工失败:', error);
              res.write(`data: ${JSON.stringify({ type: 'error', content: '创建员工失败，请重试' })}\n\n`);
            }
          } else if (fullResponse) {
            res.write(`data: ${JSON.stringify({ type: 'message', content: fullResponse })}\n\n`);
          }

          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    } catch (error) {
      logger.error('对话处理失败:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', content: '对话处理失败: ' + (error as Error).message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    logger.error('对话创建员工失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '对话处理失败' });
    }
  }
});

export default router;