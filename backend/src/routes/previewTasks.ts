/**
 * Agent Preview Tasks 路由
 * 处理异步预览任务的创建、查询和状态更新
 */

import { Router } from 'express';
import { query, getConnection } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import fetch from 'node-fetch';

const router = Router();

/**
 * 创建异步预览任务
 * POST /api/preview-tasks
 */
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      agentId,
      taskName,
      gameId,
      stageConfig,
      userInput,
      project,
      cloudProvider = 'aliyun'
    } = req.body;

    // 验证必填字段
    if (!agentId || !taskName) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段: agentId, taskName'
      });
    }

    // 生成 taskId
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 查询 agent 获取 type、ai_model 和 default_requirements
    const agents = await query(
      'SELECT type, ai_model, default_requirements FROM agents WHERE id = ?',
      [agentId]
    );

    if (!agents || agents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent 不存在'
      });
    }

    const agent = agents[0];

    // 将 agent type 映射到 stageId
    const agentStageMap: Record<string, string> = {
      planner: 'planning',
      architect: 'tech',      // 架构师属于技术阶段
      artist: 'art',
      developer: 'tech',
      tester: 'test',
      operator: 'planning',
      music: 'music',
    };

    const stageId = agentStageMap[agent.type] || 'planning';

    // 插入任务记录
    await query(
      `INSERT INTO agent_preview_tasks
       (task_id, user_id, agent_id, task_name, game_id, status, progress, stage_id, config)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
      [
        taskId,
        userId,
        agentId,
        taskName,
        gameId || null,
        stageId,
        JSON.stringify({
          stageConfig,
          userInput,
          project,
          cloudProvider
        })
      ]
    );

    // 构建回调URL
    const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/preview-tasks/${taskId}/callback`;

    // 调用 my-agent-test 的异步预览接口
    const agentTestUrl = process.env.AGENT_TEST_URL || 'http://localhost:8080';

    // 合并 Agent 的默认需求描述
    // 如果用户没有提供 additionalRequirements，使用 Agent 的 default_requirements
    // 如果都有，则合并（用户的在前，Agent 的在后）
    const mergedUserInput = {
      ...userInput,
      additionalRequirements:
        userInput?.additionalRequirements && agent.default_requirements
          ? `${userInput.additionalRequirements}\n\n### Agent 默认要求\n${agent.default_requirements}`
          : userInput?.additionalRequirements || agent.default_requirements || undefined
    };

    const previewResponse = await fetch(`${agentTestUrl}/api/executions/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stage: {
          stageId,
          agentId: `agent-${agentId}`,
          model: agent.ai_model, // 传递agent的AI模型
          ...stageConfig // 允许前端覆盖
        },
        project,
        cloudProvider,
        userInput: mergedUserInput,
        taskId,
        callbackUrl,
        async: true // 启用异步模式
      })
    });

    if (!previewResponse.ok) {
      const error = await previewResponse.text();
      throw new Error(`调用 my-agent-test 失败: ${error}`);
    }

    const previewResult = await previewResponse.json();

    // 更新任务状态为 running
    await query(
      `UPDATE agent_preview_tasks
       SET status = 'running', start_time = NOW()
       WHERE task_id = ?`,
      [taskId]
    );

    res.json({
      success: true,
      data: {
        taskId,
        status: 'running',
        agentId,
        stageId,
        message: '任务已创建并开始执行'
      }
    });

  } catch (error) {
    console.error('创建预览任务失败:', error);
    res.status(500).json({
      success: false,
      message: '创建预览任务失败',
      error: (error as Error).message
    });
  }
});

/**
 * 获取用户的所有预览任务
 * GET /api/preview-tasks
 */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { status, limit = 20, offset = 0 } = req.query;

    // 确保 limit 和 offset 是安全的整数
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string) || 20));
    const offsetNum = Math.max(0, parseInt(offset as string) || 0);

    let sql = `
      SELECT t.*, a.name as agent_name, a.type as agent_type
      FROM agent_preview_tasks t
      LEFT JOIN agents a ON t.agent_id = a.id
      WHERE t.user_id = ?
    `;
    const params: any[] = [userId];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ` ORDER BY t.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const tasks = await query(sql, params);

    res.json({
      success: true,
      data: tasks
    });

  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务列表失败',
      error: (error as Error).message
    });
  }
});

/**
 * 获取单个任务详情
 * GET /api/preview-tasks/:taskId
 */
router.get('/:taskId', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    const tasks = await query(
      `SELECT t.*, a.name as agent_name, a.type as agent_type
       FROM agent_preview_tasks t
       LEFT JOIN agents a ON t.agent_id = a.id
       WHERE t.task_id = ? AND t.user_id = ?`,
      [taskId, userId]
    );

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    res.json({
      success: true,
      data: tasks[0]
    });

  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取任务详情失败',
      error: (error as Error).message
    });
  }
});

/**
 * 接收 my-agent-test 的状态回调
 * POST /api/preview-tasks/:taskId/callback
 */
router.post('/:taskId/callback', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status, progress, resultData, errorMessage } = req.body;

    console.log(`[任务回调] taskId: ${taskId}, status: ${status}, progress: ${progress}%`);

    // 构建更新SQL
    let updateFields = ['progress = ?'];
    const updateParams: any[] = [progress || 0];

    if (status) {
      updateFields.push('status = ?');
      updateParams.push(status);
    }

    if (status === 'completed' || status === 'failed') {
      updateFields.push('complete_time = NOW()');
    }

    if (resultData) {
      updateFields.push('result_data = ?');
      updateParams.push(JSON.stringify(resultData));
    }

    if (errorMessage) {
      updateFields.push('error_message = ?');
      updateParams.push(errorMessage);
    }

    updateParams.push(taskId);

    await query(
      `UPDATE agent_preview_tasks SET ${updateFields.join(', ')} WHERE task_id = ?`,
      updateParams
    );

    res.json({
      success: true,
      message: '状态已更新'
    });

  } catch (error) {
    console.error('更新任务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新任务状态失败',
      error: (error as Error).message
    });
  }
});

/**
 * 停止运行中的任务
 * POST /api/preview-tasks/:taskId/stop
 */
router.post('/:taskId/stop', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    // 验证任务所有权
    const tasks = await query(
      'SELECT * FROM agent_preview_tasks WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    );

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const task = tasks[0];

    // 只能停止运行中或等待中的任务
    if (task.status !== 'running' && task.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `无法停止${task.status === 'completed' ? '已完成' : '已失败'}的任务`
      });
    }

    // 调用 my-agent-test 的停止API
    const agentTestUrl = process.env.AGENT_TEST_URL || 'http://localhost:8080';
    try {
      const stopResponse = await fetch(`${agentTestUrl}/api/tasks/${taskId}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!stopResponse.ok) {
        console.warn(`调用 my-agent-test 停止接口失败: ${stopResponse.status}`);
      }
    } catch (error) {
      console.warn('调用 my-agent-test 停止接口失败:', error);
    }

    // 更新任务状态为失败
    await query(
      `UPDATE agent_preview_tasks
       SET status = 'failed',
           error_message = '用户手动停止',
           complete_time = NOW()
       WHERE task_id = ?`,
      [taskId]
    );

    res.json({
      success: true,
      message: '任务已停止'
    });

  } catch (error) {
    console.error('停止任务失败:', error);
    res.status(500).json({
      success: false,
      message: '停止任务失败',
      error: (error as Error).message
    });
  }
});

/**
 * 重启失败的任务
 * POST /api/preview-tasks/:taskId/restart
 */
router.post('/:taskId/restart', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    // 验证任务所有权并获取agent的ai_model
    const tasks = await query(
      'SELECT t.*, a.type, a.ai_model FROM agent_preview_tasks t LEFT JOIN agents a ON t.agent_id = a.id WHERE t.task_id = ? AND t.user_id = ?',
      [taskId, userId]
    );

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const task = tasks[0];

    // 只能重启失败的任务
    if (task.status !== 'failed') {
      return res.status(400).json({
        success: false,
        message: '只能重启失败的任务'
      });
    }

    // 解析配置 - 如果已经是对象就直接使用，否则需要解析
    let config;
    if (typeof task.config === 'string') {
      config = JSON.parse(task.config);
    } else if (typeof task.config === 'object' && task.config !== null) {
      config = task.config;
    } else {
      throw new Error('配置格式无效');
    }

    // 将 agent type 映射到 stageId
    const agentStageMap: Record<string, string> = {
      planner: 'planning',
      architect: 'tech',
      artist: 'art',
      developer: 'tech',
      tester: 'test',
      operator: 'planning',
      music: 'music',
    };

    const stageId = agentStageMap[task.type] || 'planning';

    // 重置任务状态
    await query(
      `UPDATE agent_preview_tasks
       SET status = 'pending',
           progress = 0,
           error_message = NULL,
           start_time = NULL,
           complete_time = NULL
       WHERE task_id = ?`,
      [taskId]
    );

    // 构建回调URL
    const callbackUrl = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/preview-tasks/${taskId}/callback`;

    // 调用 my-agent-test 的异步预览接口
    const agentTestUrl = process.env.AGENT_TEST_URL || 'http://localhost:8080';

    const previewResponse = await fetch(`${agentTestUrl}/api/executions/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stage: {
          stageId,
          agentId: `agent-${task.agent_id}`,
          model: task.ai_model, // 传递agent的AI模型
          ...config.stageConfig
        },
        project: config.project,
        cloudProvider: config.cloudProvider,
        userInput: config.userInput,
        taskId,
        callbackUrl,
        async: true
      })
    });

    if (!previewResponse.ok) {
      const error = await previewResponse.text();
      throw new Error(`调用 my-agent-test 失败: ${error}`);
    }

    // 更新任务状态为运行中
    await query(
      `UPDATE agent_preview_tasks
       SET status = 'running', start_time = NOW()
       WHERE task_id = ?`,
      [taskId]
    );

    res.json({
      success: true,
      message: '任务已重启',
      data: {
        taskId,
        status: 'running'
      }
    });

  } catch (error) {
    console.error('重启任务失败:', error);

    // 恢复任务为失败状态
    await query(
      `UPDATE agent_preview_tasks SET status = 'failed' WHERE task_id = ?`,
      [req.params.taskId]
    );

    res.status(500).json({
      success: false,
      message: '重启任务失败',
      error: (error as Error).message
    });
  }
});

/**
 * SSE订阅任务状态更新（代理my-agent-test的SSE端点）
 * GET /api/preview-tasks/:taskId/events
 */
router.get('/:taskId/events', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    // 验证任务所有权
    const tasks = await query(
      'SELECT * FROM agent_preview_tasks WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    );

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    console.log(`[SSE] 用户 ${userId} 订阅任务 ${taskId} 的状态更新`);

    // 代理到my-agent-test的SSE端点
    const agentTestUrl = process.env.AGENT_TEST_URL || 'http://localhost:8080';
    const sseUrl = `${agentTestUrl}/api/tasks/${taskId}/events`;

    try {
      const fetch = (await import('node-fetch')).default;
      const sseResponse = await fetch(sseUrl);

      if (!sseResponse.ok) {
        throw new Error(`SSE连接失败: ${sseResponse.status}`);
      }

      // 转发SSE数据流
      sseResponse.body?.on('data', (chunk) => {
        res.write(chunk);
      });

      sseResponse.body?.on('end', () => {
        res.end();
      });

      sseResponse.body?.on('error', (error) => {
        console.error(`[SSE] 数据流错误:`, error);
        res.end();
      });

    } catch (error) {
      console.error('[SSE] 代理连接失败:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: '无法连接到Agent服务器' })}\n\n`);
      res.end();
    }

    // 客户端断开连接时清理
    req.on('close', () => {
      console.log(`[SSE] 用户 ${userId} 断开任务 ${taskId} 的订阅`);
      res.end();
    });

  } catch (error) {
    console.error('SSE订阅失败:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'SSE订阅失败',
        error: (error as Error).message
      });
    }
  }
});

/**
 * 删除任务
 * DELETE /api/preview-tasks/:taskId
 */
router.delete('/:taskId', authenticate, async (req: AuthRequest, res) => {
  console.log(`[DELETE] 接收到删除任务请求: taskId=${req.params.taskId}, userId=${req.user?.id}`);
  try {
    const userId = req.user!.id;
    const { taskId } = req.params;

    // 验证任务所有权
    const tasks = await query(
      'SELECT * FROM agent_preview_tasks WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    );

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      });
    }

    const task = tasks[0];

    // 只能删除已完成或已失败的任务
    if (task.status !== 'completed' && task.status !== 'failed') {
      return res.status(400).json({
        success: false,
        message: '只能删除已完成或已失败的任务'
      });
    }

    // 删除任务记录
    await query(
      'DELETE FROM agent_preview_tasks WHERE task_id = ?',
      [taskId]
    );

    res.json({
      success: true,
      message: '任务已删除'
    });

  } catch (error) {
    console.error('删除任务失败:', error);
    res.status(500).json({
      success: false,
      message: '删除任务失败',
      error: (error as Error).message
    });
  }
});

console.log('[PreviewTasks Router] DELETE /:taskId route registered');

export default router;
