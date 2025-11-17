import { Router } from 'express';
import fetch from 'node-fetch';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../config/database';
import logger from '../utils/logger';
import { validateWorkflowExecution } from '../middleware/validation';
import { workflowQueue } from '../services/workflowQueue';
import {
  fetchExecution,
  fetchStageContext,
  controlStage,
  updateStage,
  previewAgentStage,
  fetchClarifications,
  submitClarifications,
  buildHeaders,
  MY_AGENT_BASE_URL,
} from '../services/myAgentClient';
import {
  DEFAULT_STAGE_BLUEPRINT,
  WORKFLOW_MAP,
  buildExecutionRequest,
  mapAgentTypeToStage,
} from '../services/workflowBuilder';
import { StageConfigInput } from '../types/workflow';

const router = Router();

router.post(
  '/companies/:companyId/execute',
  authenticate,
  validateWorkflowExecution,
  async (req: AuthRequest, res) => {
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
      logger.error('触发workflow失败', error);
      res.status(500).json({ success: false, message: '触发workflow失败' });
    }
  }
);

router.get('/jobs', authenticate, async (req: AuthRequest, res) => {
  const companyId =
    typeof req.query.companyId === 'string' ? Number(req.query.companyId) : undefined;
  if (companyId !== undefined && Number.isNaN(companyId)) {
    return res.status(400).json({ success: false, message: 'companyId 参数无效' });
  }

  try {
    const jobs = await workflowQueue.listJobs(req.user!.id, companyId);
    res.json({ success: true, data: jobs });
  } catch (error) {
    logger.error('获取workflow任务列表失败', error);
    res.status(500).json({ success: false, message: '获取任务列表失败' });
  }
});

router.get('/jobs/:jobId', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: '任务不存在' });
  }
  if (job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权查看此任务' });
  }

  res.json({
    success: true,
    data: {
      ...job,
      etaMs: job.etaMs ?? workflowQueue.estimateWaitMs(job.position || 0),
    },
  });
});

router.get('/executions/:executionId', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.findJobByExecutionId(req.params.executionId);
  if (!job || job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权访问该执行' });
  }

  try {
    const data = await fetchExecution(req.params.executionId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('获取执行详情失败', error);
    res.status(500).json({ success: false, message: '获取执行详情失败' });
  }
});

router.get('/executions/:executionId/stages/:stageId', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.findJobByExecutionId(req.params.executionId);
  if (!job || job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权访问该执行' });
  }

  try {
    const data = await fetchStageContext(req.params.executionId, req.params.stageId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('获取阶段上下文失败', error);
    res.status(500).json({ success: false, message: '获取阶段上下文失败' });
  }
});

router.post('/executions/:executionId/stages/:stageId/pause', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.findJobByExecutionId(req.params.executionId);
  if (!job || job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权访问该执行' });
  }
  await controlStage(req.params.executionId, req.params.stageId, 'pause', req.body);
  res.json({ success: true });
});

router.post('/executions/:executionId/stages/:stageId/resume', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.findJobByExecutionId(req.params.executionId);
  if (!job || job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权访问该执行' });
  }
  await controlStage(req.params.executionId, req.params.stageId, 'resume', req.body);
  res.json({ success: true });
});

router.post('/executions/:executionId/stages/:stageId/updates', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.findJobByExecutionId(req.params.executionId);
  if (!job || job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权访问该执行' });
  }
  await updateStage(req.params.executionId, req.params.stageId, req.body);
  res.json({ success: true });
});

router.get('/executions/:executionId/clarifications', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.findJobByExecutionId(req.params.executionId);
  if (!job || job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权访问该执行' });
  }

  try {
    const data = await fetchClarifications(req.params.executionId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('获取澄清信息失败', error);
    res.status(500).json({ success: false, message: '获取澄清信息失败' });
  }
});

router.post('/executions/:executionId/clarifications', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.findJobByExecutionId(req.params.executionId);
  if (!job || job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权访问该执行' });
  }

  const responses = Array.isArray(req.body?.responses) ? req.body.responses : [];
  const normalized = responses
    .filter((item: any) => item?.questionId && item?.answer)
    .map((item: any) => ({
      questionId: String(item.questionId),
      answer: String(item.answer),
    }));

  if (!normalized.length) {
    return res.status(400).json({ success: false, message: '缺少有效的回答内容' });
  }

  try {
    const data = await submitClarifications(req.params.executionId, { responses: normalized });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('提交澄清信息失败', error);
    res.status(500).json({ success: false, message: '提交澄清信息失败' });
  }
});

router.get('/executions/:executionId/events', authenticate, async (req: AuthRequest, res) => {
  const job = await workflowQueue.findJobByExecutionId(req.params.executionId);
  if (!job || job.ownerId !== req.user!.id) {
    return res.status(403).json({ success: false, message: '无权访问该执行' });
  }

  const controller = new AbortController();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const upstream = await fetch(`${MY_AGENT_BASE_URL}/executions/${req.params.executionId}/events`, {
      headers: buildHeaders(),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      controller.abort();
      res.status(upstream.status).end('upstream_error');
      return;
    }

    upstream.body.on('data', (chunk: Buffer) => {
      res.write(chunk);
    });

    upstream.body.on('error', (err: any) => {
      logger.error('事件流连接异常', err);
      controller.abort();
      res.end();
    });

    req.on('close', () => {
      controller.abort();
      upstream.body?.destroy();
    });
  } catch (error) {
    controller.abort();
    logger.error('代理事件流失败', error);
    res.end();
  }
});

router.get('/capacity', authenticate, async (_req, res) => {
  const metrics = await workflowQueue.getMetrics();
  res.json({ success: true, data: metrics });
});

router.post('/agents/:agentId/preview', authenticate, async (req: AuthRequest, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.user!.id;
    const agents = await query<any[]>(
      'SELECT * FROM employee_agents WHERE id = ? AND owner_id = ?',
      [agentId, userId]
    );
    if (!agents.length) {
      return res.status(404).json({ success: false, message: '员工不存在或无权操作' });
    }

    const { project, stage } = req.body;
    if (!project || !stage) {
      return res.status(400).json({ success: false, message: '缺少project或stage参数' });
    }

    const stageConfig: StageConfigInput = {
      stageId: stage.stageId || mapAgentTypeToStage(agents[0].type),
      agentId: stage.agentId || `${stage.stageId || mapAgentTypeToStage(agents[0].type)}-agent`,
      model: stage.model || agents[0].ai_model || 'default-model',
      knowledgeBase: stage.knowledgeBase,
      mode: stage.mode || 'llm+kb',
      tools: stage.tools,
      mcp: stage.mcp,
      resources: stage.resources,
      expectedArtifacts: stage.expectedArtifacts,
    };

    const response = await previewAgentStage({
      stage: stageConfig,
      project,
      cloudProvider: req.body.cloudProvider || 'aliyun',
    });

    res.json({ success: true, data: response });
  } catch (error) {
    logger.error('Agent预览失败', error);
    res.status(500).json({ success: false, message: 'Agent预览失败' });
  }
});

export default router;

