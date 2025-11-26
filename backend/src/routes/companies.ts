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
import { conversationalService } from '../services/conversationalService';

const router = Router();

// 安全解析 AI 返回的 JSON，处理转义字符和格式问题
function safeJSONParse(jsonString: string): any {
  try {
    // 尝试直接解析
    return JSON.parse(jsonString);
  } catch (error) {
    try {
      // 清理字符串
      let cleaned = jsonString
        .trim()
        .replace(/\n/g, '')
        .replace(/\r/g, '')
        .replace(/\t/g, '');
      
      // 检测多个连续的 JSON 对象（如 {...}{...}{...}）
      // 这种情况下只取第一个对象
      const firstBrace = cleaned.indexOf('{');
      if (firstBrace !== -1) {
        let braceCount = 0;
        let firstObjectEnd = -1;
        
        for (let i = firstBrace; i < cleaned.length; i++) {
          if (cleaned[i] === '{') braceCount++;
          else if (cleaned[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              firstObjectEnd = i;
              break;
            }
          }
        }
        
        if (firstObjectEnd !== -1) {
          cleaned = cleaned.substring(firstBrace, firstObjectEnd + 1);
        }
      }
      
      return JSON.parse(cleaned);
    } catch (secondError) {
      logger.error('JSON 解析失败:', { 
        original: jsonString,
        firstError: error instanceof Error ? error.message : 'Unknown',
        secondError: secondError instanceof Error ? secondError.message : 'Unknown'
      });
      throw new Error('AI 返回的参数格式错误');
    }
  }
}

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

// 对话式创建公司（流式SSE版本）
router.post('/conversational', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message: userMessage, model, conversationHistory, state } = req.body;
    const userId = req.user!.id;

    if (!model || !userMessage) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数：model 和 message',
      });
    }

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const messages = [...(conversationHistory || []), { role: 'user', content: userMessage }];
    const currentPhase = state?.phase || 'company';
    const currentCompanyId = state?.companyId;
    let createdEmployees = state?.createdEmployees || [];

    try {
      // 使用流式处理
      const stream = conversationalService.processCompanyCreationStream(model, messages, {
        phase: currentPhase,
        companyId: currentCompanyId,
        createdEmployees,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'token') {
          res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'function_call') {
          // 执行函数调用 - 安全解析 JSON
          let args: any;
          try {
            args = safeJSONParse(chunk.functionCall.arguments);
          } catch (error) {
            res.write(`data: ${JSON.stringify({ 
              type: 'error', 
              content: error instanceof Error ? error.message : 'AI 返回的参数格式错误' 
            })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          const connection = await getConnection();

          try {
            await connection.beginTransaction();

            if (currentPhase === 'company') {
              // 创建公司
              const userBalance = await connection.execute(
                'SELECT game_coins FROM users WHERE id = ?',
                [userId]
              );
              const currentBalance = userBalance[0][0]?.game_coins || 0;
              
              if (currentBalance < args.initialCapital) {
                await connection.rollback();
                res.write(`data: ${JSON.stringify({ type: 'error', content: '游戏币余额不足' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
                connection.release();
                return;
              }

              const companyResult = await connection.execute(
                `INSERT INTO companies (owner_id, name, description, max_employees, 
                  workflow_type, initial_capital, current_capital, status, workflow_config) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL)`,
                [userId, args.name, args.description || null, 6, args.workflowType, args.initialCapital, args.initialCapital]
              );
              const newCompanyId = (companyResult[0] as any).insertId;

              await connection.execute('UPDATE users SET game_coins = game_coins - ? WHERE id = ?', [args.initialCapital, userId]);
              const balanceAfter = currentBalance - args.initialCapital;
              await connection.execute(
                `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, related_type, related_id) 
                 VALUES (?, 'spend', ?, ?, '创建公司扣除初始资金', 'company', ?)`,
                [userId, args.initialCapital, balanceAfter, newCompanyId]
              );

              await connection.commit();
              await redisClient.del(`user:${userId}:companies`);
              await redisClient.del(`user:${userId}:balance`);

              logger.info(`用户 ${userId} 通过对话创建了公司 ${newCompanyId}: ${args.name}`);

              res.write(`data: ${JSON.stringify({ 
                type: 'success', 
                content: `公司"${args.name}"创建成功！现在请为公司雇佣6位必需员工（策划、架构师、美术、研发、测试、音频）。`,
                companyId: newCompanyId,
                phase: 'employees'
              })}\n\n`);
            } else {
              // 创建员工
              const agentResult = await connection.execute(
                `INSERT INTO employee_agents (name, type, dimension, ai_model, specialization, extra_traits, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'available')`,
                [args.name, args.type, args.dimension, args.ai_model, args.specialization, args.extra_traits || null]
              );
              const newAgentId = (agentResult[0] as any).insertId;

              await connection.execute(
                `INSERT INTO company_employees (company_id, employee_id, status, hired_at) VALUES (?, ?, 'active', NOW())`,
                [currentCompanyId, newAgentId]
              );
              await connection.execute(`UPDATE employee_agents SET status = 'employed' WHERE id = ?`, [newAgentId]);

              await connection.commit();
              await redisClient.del(`user:${userId}:agents:all:all`);
              await redisClient.del(`company:${currentCompanyId}:employees`);

              logger.info(`用户 ${userId} 为公司 ${currentCompanyId} 雇佣了员工 ${newAgentId}: ${args.name} (${args.type})`);

              const updatedEmployees = [...createdEmployees, args.type];
              // 更新本次流的已创建员工列表，供后续判断
              createdEmployees = updatedEmployees;

              res.write(`data: ${JSON.stringify({ 
                type: 'success', 
                content: `员工"${args.name}"（${args.type}）雇佣成功！`,
                agentId: newAgentId,
                agentType: args.type,
                phase: 'employees'
              })}\n\n`);

              // 如果已完成 6 名必需员工，调用 suggestProject 并发出 ask_execute 事件
              try {
                const REQUIRED_TYPES = ['planner', 'architect', 'artist', 'developer', 'tester', 'music'];
                const satisfied = REQUIRED_TYPES.every(t => updatedEmployees.includes(t));
                if (satisfied) {
                  // 请求模型给出结构化的项目建议
                  let suggestedProject: any = null;
                  try {
                    suggestedProject = await conversationalService.suggestProject(model, messages as any);
                  } catch (e) {
                    logger.warn('suggestProject 失败，回退到 assistant 文本', e);
                    suggestedProject = { additionalRequirements: '' };
                  }

                  res.write(`data: ${JSON.stringify({ type: 'ask_execute', content: '是否现在执行工作流？', suggestedProject })}\n\n`);
                }
              } catch (e) {
                logger.warn('ask_execute 事件发送失败', e);
              }
            }

            connection.release();
          } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
          }
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      logger.error('对话流式处理失败:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', content: error.message || '处理失败' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error: any) {
    logger.error('对话式创建公司失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '对话式创建失败',
    });
  }
});

// 对话式创建公司（完整流程：公司 + 6个必需员工）
router.post('/conversational-create', authenticate, async (req: AuthRequest, res) => {
  try {
    const { model, messages, phase, companyId, createdEmployees } = req.body;
    const userId = req.user!.id;

    if (!model || !messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数：model 和 messages',
      });
    }

    // 确定当前阶段：company（创建公司）或 employees（创建员工）
    const currentPhase = phase || 'company';
    const employeesList = createdEmployees || [];

    // 调用 LLM 服务
    const result = await conversationalService.processCompanyCreation(model, messages, {
      phase: currentPhase,
      companyId,
      createdEmployees: employeesList,
    });

    if (result.shouldExecute && result.functionCall) {
      // 安全解析 JSON
      let args: any;
      try {
        args = safeJSONParse(result.functionCall.arguments);
      } catch (error) {
        return res.status(400).json({
          success: false,
          reply: error instanceof Error ? error.message : 'AI 返回的参数格式错误',
        });
      }
      const connection = await getConnection();

      try {
        await connection.beginTransaction();

        if (currentPhase === 'company') {
          // 阶段1：创建公司
          // 检查公司数量限制（最多5家）
          const companyCount = await connection.execute(
            'SELECT COUNT(*) as count FROM companies WHERE owner_id = ?',
            [userId]
          );
          const currentCompanyCount = companyCount[0][0]?.count || 0;
          if (currentCompanyCount >= 5) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              reply: '您已经拥有5家公司（达到上限），请先删除一家公司后再创建新公司。',
            });
          }

          // 检查游戏币余额
          const userBalance = await connection.execute(
            'SELECT game_coins FROM users WHERE id = ?',
            [userId]
          );
          const currentBalance = userBalance[0][0]?.game_coins || 0;
          if (currentBalance < args.initialCapital) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              reply: '游戏币余额不足，无法创建公司。',
            });
          }

          // 创建公司
          const companyResult = await connection.execute(
            `INSERT INTO companies (owner_id, name, description, max_employees, 
              workflow_type, initial_capital, current_capital, status, workflow_config) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NULL)`,
            [userId, args.name, args.description || null, args.maxEmployees, args.workflowType, args.initialCapital, args.initialCapital]
          );
          const newCompanyId = (companyResult[0] as any).insertId;

          // 扣除游戏币
          await connection.execute('UPDATE users SET game_coins = game_coins - ? WHERE id = ?', [args.initialCapital, userId]);
          const balanceAfter = currentBalance - args.initialCapital;
          await connection.execute(
            `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, related_type, related_id) 
             VALUES (?, 'spend', ?, ?, '创建公司扣除初始资金', 'company', ?)`,
            [userId, args.initialCapital, balanceAfter, newCompanyId]
          );

          await connection.commit();
          await kafkaProducer.send({
            topic: 'company-events',
            messages: [{ value: JSON.stringify({ event: 'company_created', companyId: newCompanyId, userId, name: args.name, timestamp: new Date().toISOString() }) }],
          });
          await redisClient.del(`user:${userId}:companies`);
          await redisClient.del(`user:${userId}:balance`);

          logger.info(`用户 ${userId} 通过对话创建了公司 ${newCompanyId}: ${args.name}`);

          // 进入员工创建阶段
          const REQUIRED_TYPES = ['planner', 'architect', 'artist', 'developer', 'tester', 'music'];
          res.json({
            success: true,
            phase: 'employees',
            companyId: newCompanyId,
            createdEmployees: [],
            requiredEmployees: REQUIRED_TYPES,
            functionCall: result.functionCall,
            reply: `公司"${args.name}"创建成功！\n\n现在让我们为公司雇佣必需的6位员工：\n1. 策划（planner）\n2. 架构师（architect）\n3. 美术（artist）\n4. 研发（developer）\n5. 测试（tester）\n6. 音频（music）\n\n请告诉我第一位员工（策划）的信息。`,
          });
        } else {
          // 阶段2：创建员工
          // 检查员工总数限制（最多30个）
          const agentCount = await connection.execute(
            'SELECT COUNT(*) as count FROM employee_agents WHERE id IN (SELECT employee_id FROM company_employees WHERE company_id IN (SELECT id FROM companies WHERE owner_id = ?))',
            [userId]
          );
          const currentAgentCount = agentCount[0][0]?.count || 0;
          if (currentAgentCount >= 30) {
            await connection.rollback();
            return res.status(400).json({
              success: false,
              reply: '您的员工数量已达上限（30个），无法继续雇佣。',
            });
          }

          // 创建员工
          const agentResult = await connection.execute(
            `INSERT INTO employee_agents (name, type, dimension, ai_model, specialization, extra_traits, status)
             VALUES (?, ?, ?, ?, ?, ?, 'available')`,
            [args.name, args.type, args.dimension, args.ai_model, args.specialization, args.extra_traits || null]
          );
          const newAgentId = (agentResult[0] as any).insertId;

          // 关联到公司
          await connection.execute(
            `INSERT INTO company_employees (company_id, employee_id, status, hired_at) VALUES (?, ?, 'active', NOW())`,
            [companyId, newAgentId]
          );
          await connection.execute(`UPDATE employee_agents SET status = 'employed' WHERE id = ?`, [newAgentId]);

          await connection.commit();
          await kafkaProducer.send({
            topic: 'agent-events',
            messages: [{ value: JSON.stringify({ event: 'agent_hired', agentId: newAgentId, companyId, userId, name: args.name, type: args.type, timestamp: new Date().toISOString() }) }],
          });
          await redisClient.del(`user:${userId}:agents:all:all`);
          await redisClient.del(`company:${companyId}:employees`);

          logger.info(`用户 ${userId} 为公司 ${companyId} 雇佣了员工 ${newAgentId}: ${args.name} (${args.type})`);

          const REQUIRED_TYPES = ['planner', 'architect', 'artist', 'developer', 'tester', 'music'];
          const updatedEmployees = [...employeesList, args.type];
          const remaining = REQUIRED_TYPES.filter(t => !updatedEmployees.includes(t));

          if (remaining.length === 0) {
            // 全部完成：尝试让模型给出结构化的项目建议并返回
            let suggestedProject = null;
            try {
              suggestedProject = await conversationalService.suggestProject(model, messages as any);
            } catch (e) {
              logger.warn('suggestProject 失败:', e);
            }

            res.json({
              success: true,
              phase: 'completed',
              companyId,
              createdEmployees: updatedEmployees,
              functionCall: result.functionCall,
              suggestedProject: suggestedProject || null,
              reply: `恭喜！员工"${args.name}"（${args.type}）雇佣成功！\n\n🎉 您的公司已经完成组建，所有6位必需员工已就位！现在可以开始制作游戏了。`,
            });
          } else {
            // 继续创建下一个员工
            const typeNameMap: Record<string, string> = {
              planner: '策划', architect: '架构师', artist: '美术', developer: '研发', tester: '测试', music: '音频'
            };
            const nextType = remaining[0];
            res.json({
              success: true,
              phase: 'employees',
              companyId,
              createdEmployees: updatedEmployees,
              requiredEmployees: REQUIRED_TYPES,
              remaining,
              functionCall: result.functionCall,
              reply: `员工"${args.name}"（${args.type}）雇佣成功！\n\n还需要雇佣 ${remaining.length} 位员工：${remaining.map(t => typeNameMap[t]).join('、')}\n\n请告诉我下一位员工（${typeNameMap[nextType]}）的信息。`,
            });
          }
        }
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
        phase: currentPhase,
        companyId,
        createdEmployees: employeesList,
        reply: result.reply,
      });
    }
  } catch (error: any) {
    logger.error('对话式创建公司失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '对话式创建失败',
    });
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
        (SELECT COUNT(*) FROM company_employees ce 
         WHERE ce.company_id = c.id AND ce.status = 'active') as current_employees
       FROM companies c 
       WHERE c.owner_id = ? AND c.status = 'active'
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

// 获取已解散公司历史
router.get('/history', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const cacheKey = `user:${userId}:companies:history`;

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
        (SELECT COUNT(*) FROM company_employees ce 
         WHERE ce.company_id = c.id AND ce.status = 'terminated') as total_employees
       FROM companies c 
       WHERE c.owner_id = ? AND c.status = 'dissolved'
       ORDER BY c.updated_at DESC`,
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
    logger.error('获取已解散公司历史失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取已解散公司历史失败' 
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

    // 从数据库查询
    const companies = await query<any[]>(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM agents a 
         WHERE a.company_id = c.id AND a.status = 'employed') as current_employees
       FROM companies c 
       WHERE c.id = ? AND c.owner_id = ? AND c.status = 'active'
       LIMIT 1`,
      [id, userId]
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

    // 获取所有活跃员工
    const activeEmployees = await connection.execute(
      `SELECT ce.employee_id, ea.name, ea.type, ea.status as agent_status,
        (SELECT COUNT(*) FROM company_employees WHERE employee_id = ea.id AND company_id != ? AND status = 'active') as is_market_agent
       FROM company_employees ce
       JOIN employee_agents ea ON ce.employee_id = ea.id
       WHERE ce.company_id = ? AND ce.status = 'active'`,
      [id, id]
    );

    // 遣散员工
    if (Array.isArray(activeEmployees[0]) && activeEmployees[0].length > 0) {
      for (const emp of activeEmployees[0]) {
        // 更新公司员工关系状态
        await connection.execute(
          'UPDATE company_employees SET status = "terminated", updated_at = NOW() WHERE company_id = ? AND employee_id = ?',
          [id, emp.employee_id]
        );

        // 判断员工来源：如果 is_market_agent > 0，说明是从市场购买的
        if (emp.is_market_agent > 0) {
          // 市场购买的员工：回流市场（状态改为 available）
          await connection.execute(
            'UPDATE employee_agents SET status = "available", updated_at = NOW() WHERE id = ?',
            [emp.employee_id]
          );
          logger.info(`员工 ${emp.employee_id} (${emp.name}) 从公司 ${id} 遣散，回流市场`);
        } else {
          // 用户自己创建的员工：待业状态（也是 available）
          await connection.execute(
            'UPDATE employee_agents SET status = "available", updated_at = NOW() WHERE id = ?',
            [emp.employee_id]
          );
          logger.info(`员工 ${emp.employee_id} (${emp.name}) 从公司 ${id} 遣散，进入待业状态`);
        }
      }
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

// 对话式创建公司（流式输出）
router.post('/conversational', authenticate, async (req: AuthRequest, res) => {
  try {
    const { message, model = 'gpt-4o', conversationHistory = [], state = {} } = req.body;
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
      for await (const chunk of conversationalService.processCompanyCreationStream(model, messages, state)) {
        if (chunk.type === 'token' && chunk.content) {
          fullResponse += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'function_call' && chunk.functionCall) {
          functionCall = chunk.functionCall;
        } else if (chunk.type === 'done') {
          // 如果有函数调用，执行创建操作
          if (functionCall) {
            const args = JSON.parse(functionCall.arguments);
            
            if (functionCall.name === 'create_company') {
              // 创建公司
              const connection = await getConnection();
              try {
                await connection.beginTransaction();

                const existingCompany = await connection.execute(
                  'SELECT id FROM companies WHERE owner_id = ?',
                  [userId]
                );

                if (Array.isArray(existingCompany[0]) && existingCompany[0].length > 0) {
                  await connection.rollback();
                  res.write(`data: ${JSON.stringify({ type: 'error', content: '您已经拥有一家公司，无法创建多家公司' })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  return res.end();
                }

                const userBalance = await connection.execute(
                  'SELECT game_coins FROM users WHERE id = ?',
                  [userId]
                );
                const currentBalance = userBalance[0][0]?.game_coins || 0;
                
                if (currentBalance < args.initialCapital) {
                  await connection.rollback();
                  res.write(`data: ${JSON.stringify({ type: 'error', content: '游戏币余额不足，无法创建公司' })}\n\n`);
                  res.write('data: [DONE]\n\n');
                  return res.end();
                }

                const companyResult = await connection.execute(
                  `INSERT INTO companies (owner_id, name, description, max_employees, 
                    workflow_type, initial_capital, current_capital, status) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                  [userId, args.name, args.description || '', args.maxEmployees, args.workflowType, args.initialCapital, args.initialCapital]
                );

                const companyId = (companyResult[0] as any).insertId;

                await connection.execute(
                  'UPDATE users SET game_coins = game_coins - ? WHERE id = ?',
                  [args.initialCapital, userId]
                );

                const balanceAfter = currentBalance - args.initialCapital;
                await connection.execute(
                  `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, 
                    related_type, related_id) 
                   VALUES (?, 'spend', ?, ?, '创建公司扣除初始资金', 'company', ?)`,
                  [userId, args.initialCapital, balanceAfter, companyId]
                );

                await connection.commit();

                res.write(`data: ${JSON.stringify({ 
                  type: 'success', 
                  content: `🎉 恭喜！公司「${args.name}」创建成功！`,
                  companyId,
                  phase: 'employees'
                })}\n\n`);
              } catch (error) {
                await connection.rollback();
                logger.error('创建公司失败:', error);
                res.write(`data: ${JSON.stringify({ type: 'error', content: '创建公司失败，请重试' })}\n\n`);
              }
            } else if (functionCall.name === 'create_agent') {
              // 创建员工
              const connection = await getConnection();
              try {
                await connection.beginTransaction();

                if (state.companyId) {
                  const companyOwnership = await connection.execute(
                    'SELECT id, max_employees FROM companies WHERE id = ? AND owner_id = ? AND status = "active"',
                    [state.companyId, userId]
                  );

                  if (Array.isArray(companyOwnership[0]) && companyOwnership[0].length === 0) {
                    await connection.rollback();
                    res.write(`data: ${JSON.stringify({ type: 'error', content: '无权在此公司创建员工' })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    return res.end();
                  }

                  const employeeCount = await connection.execute(
                    'SELECT COUNT(*) as count FROM agents WHERE company_id = ? AND status = "employed"',
                    [state.companyId]
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
                    args.extra_traits || null, state.companyId || null, state.companyId ? 'employed' : 'available'
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
    logger.error('对话创建公司失败:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '对话处理失败' });
    }
  }
});

// 解散公司
router.delete('/:id/dissolve', authenticate, async (req: AuthRequest, res) => {
  const connection = await getConnection();
  
  try {
    const companyId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(companyId)) {
      return res.status(400).json({ success: false, message: '无效的公司ID' });
    }

    await connection.beginTransaction();

    // 检查公司是否存在且属于当前用户
    const companyResult = await connection.execute(
      'SELECT * FROM companies WHERE id = ? AND owner_id = ?',
      [companyId, userId]
    );

    if (!Array.isArray(companyResult[0]) || companyResult[0].length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '公司不存在或无权限操作' });
    }

    const company = companyResult[0][0] as any;

    // 获取公司的所有员工
    const employeesResult = await connection.execute(
      `SELECT a.* 
       FROM agents a 
       WHERE a.company_id = ? AND a.status = 'employed'`,
      [companyId]
    );

    const employees = Array.isArray(employeesResult[0]) ? employeesResult[0] : [];

    // 处理员工：解除雇佣关系，将状态改为 available
    for (const employee of employees as any[]) {
      // 将员工的 company_id 设为 NULL，状态改为 available
      // 如果是用户自己创建的员工（owner_id == userId），保留给用户
      // 如果是从市场购买的员工（owner_id != userId），流入市场
      await connection.execute(
        'UPDATE agents SET company_id = NULL, status = ? WHERE id = ?',
        ['available', employee.id]
      );
    }

    // 更新公司状态为已解散
    await connection.execute(
      'UPDATE companies SET status = ?, updated_at = NOW() WHERE id = ?',
      ['dissolved', companyId]
    );

    // 返还剩余资金给用户
    if (company.current_capital > 0) {
      const userBalanceResult = await connection.execute(
        'SELECT game_coins FROM users WHERE id = ?',
        [userId]
      );
      const currentBalance = parseFloat(userBalanceResult[0][0]?.game_coins || 0);
      const refundAmount = parseFloat(company.current_capital);

      await connection.execute(
        'UPDATE users SET game_coins = game_coins + ? WHERE id = ?',
        [refundAmount, userId]
      );

      const newBalance = currentBalance + refundAmount;

      // 记录交易
      await connection.execute(
        `INSERT INTO coin_transactions (user_id, transaction_type, amount, balance_after, description, related_type, related_id) 
         VALUES (?, 'refund', ?, ?, '公司解散退还剩余资金', 'company', ?)`,
        [userId, refundAmount, newBalance, companyId]
      );
    }

    await connection.commit();

    // 清除缓存
    await redisClient.del(`user:${userId}:companies`);
    await redisClient.del(`user:${userId}:balance`);
    await redisClient.del(`user:${userId}:companies:history`);
    await redisClient.del(`company:${companyId}:employees`);

    logger.info(`用户 ${userId} 解散了公司 ${companyId}: ${company.name}, 退还资金 ${company.current_capital}, 处理员工 ${employees.length} 名`);

    res.json({
      success: true,
      message: '公司已成功解散',
      data: {
        refundAmount: company.current_capital,
        employeesProcessed: employees.length,
      },
    });
  } catch (error) {
    await connection.rollback();
    logger.error('解散公司失败:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '解散公司失败',
    });
  } finally {
    connection.release();
  }
});

export default router;