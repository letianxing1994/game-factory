import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../config/redis';
import logger from '../utils/logger';
import {
  ExecutionRequestInput,
  WorkflowJobRecord,
  WorkflowResultMessage,
  WorkflowTaskMessage,
} from '../types/workflow';
import { createConsumer, sendMessage } from '../config/kafka';

const CONCURRENCY = Number(process.env.WORKFLOW_CONCURRENCY || 25);
const AVG_STAGE_MS = Number(process.env.WORKFLOW_AVG_TIME_MS || 180_000);
const JOB_KEY_PREFIX = 'workflow:job:';
const EXEC_INDEX_PREFIX = 'workflow:execution:';
const QUEUE_LIST_KEY = 'workflow:queue:list';
const RUNNING_SET_KEY = 'workflow:running:set';
const USER_JOB_SET_PREFIX = 'workflow:user:jobs:';
const TASK_TOPIC = process.env.WORKFLOW_TASK_TOPIC || 'workflow-tasks';
const RESULT_TOPIC = process.env.WORKFLOW_RESULT_TOPIC || 'workflow-results';
const RESULT_GROUP = process.env.WORKFLOW_RESULT_GROUP || 'game-factory-workflow-results';

class WorkflowQueue {
  private resultConsumerStarted = false;

  async enqueue(companyId: number, ownerId: number, payload: ExecutionRequestInput) {
    const jobId = uuidv4();
    const enqueuedAt = new Date().toISOString();
    const position = await redisClient.rPush(QUEUE_LIST_KEY, jobId);
    const record: WorkflowJobRecord = {
      jobId,
      companyId,
      ownerId,
      status: 'queued',
      position,
      createdAt: enqueuedAt,
      updatedAt: enqueuedAt,
      etaMs: this.estimateWaitMs(position),
      payload,
    };
    await this.setJobRecord(jobId, record);
    await redisClient.sAdd(`${USER_JOB_SET_PREFIX}${ownerId}`, jobId);

    const taskMessage: WorkflowTaskMessage = {
      jobId,
      companyId,
      ownerId,
      payload,
      enqueuedAt,
    };

    await sendMessage(TASK_TOPIC, taskMessage);
    return jobId;
  }

  async getJob(jobId: string): Promise<WorkflowJobRecord | null> {
    const data = await redisClient.get(`${JOB_KEY_PREFIX}${jobId}`);
    if (!data) return null;
    const record = JSON.parse(data) as WorkflowJobRecord;
    if (record.status === 'queued') {
      const position = await this.getQueuePosition(jobId);
      record.position = position;
      record.etaMs = this.estimateWaitMs(position);
    } else {
      record.position = 0;
      record.etaMs = 0;
    }
    return record;
  }

  async findJobByExecutionId(executionId: string) {
    const jobId = await redisClient.get(`${EXEC_INDEX_PREFIX}${executionId}`);
    if (!jobId) return null;
    return this.getJob(jobId);
  }

  async getMetrics() {
    const [queued, running] = await Promise.all([
      redisClient.lLen(QUEUE_LIST_KEY),
      redisClient.sCard(RUNNING_SET_KEY),
    ]);
    return {
      concurrency: CONCURRENCY,
      running,
      queued,
      avgDurationMs: AVG_STAGE_MS,
    };
  }

  async listJobs(ownerId: number, companyId?: number) {
    const jobIds = await redisClient.sMembers(`${USER_JOB_SET_PREFIX}${ownerId}`);
    if (!jobIds.length) return [];
    const records = await Promise.all(jobIds.map((jobId) => this.getJob(jobId)));
    const filtered = records
      .filter((job): job is WorkflowJobRecord => {
        if (!job) return false;
        if (companyId && job.companyId !== companyId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return filtered.slice(0, 25);
  }

  estimateWaitMs(position: number) {
    if (position <= 0) return 0;
    return Math.ceil(position / CONCURRENCY) * AVG_STAGE_MS;
  }

  async startResultConsumer() {
    if (this.resultConsumerStarted) return;
    await createConsumer(RESULT_GROUP, [RESULT_TOPIC], async (message) => {
      await this.handleResultEvent(message as WorkflowResultMessage);
    });
    this.resultConsumerStarted = true;
    logger.info('Workflow result consumer started');
  }

  private async handleResultEvent(event: WorkflowResultMessage) {
    if (!event?.jobId) {
      logger.warn('忽略无jobId的workflow结果事件', event);
      return;
    }
    const job = await this.getJob(event.jobId);
    if (!job) {
      logger.warn('找不到对应的workflow job', event.jobId);
      return;
    }

    try {
      if (event.status === 'running' || event.status === 'clarifying') {
        await this.removeFromQueue(event.jobId);
        await redisClient.sAdd(RUNNING_SET_KEY, event.jobId);
        await this.updateJob(event.jobId, {
          status: event.status,
          executionId: event.executionId ?? job.executionId,
          projectId: event.projectId ?? job.projectId,
          startedAt: event.startedAt || new Date().toISOString(),
          position: 0,
          etaMs: 0,
          message: event.message,
        });
        if (event.executionId) {
          await redisClient.set(`${EXEC_INDEX_PREFIX}${event.executionId}`, event.jobId);
        }
        return;
      }

      if (event.status === 'completed' || event.status === 'failed') {
        await redisClient.sRem(RUNNING_SET_KEY, event.jobId);
        await this.removeFromQueue(event.jobId);
        await this.updateJob(event.jobId, {
          status: event.status,
          executionId: event.executionId ?? job.executionId,
          projectId: event.projectId ?? job.projectId,
          finishedAt: event.finishedAt || new Date().toISOString(),
          error: event.error,
          message: event.message,
          position: 0,
          etaMs: 0,
        });
        if (event.executionId) {
          await redisClient.set(`${EXEC_INDEX_PREFIX}${event.executionId}`, event.jobId);
        }
      }
    } catch (error) {
      logger.error('处理workflow结果事件失败', { event, error });
    }
  }

  private async removeFromQueue(jobId: string) {
    await redisClient.lRem(QUEUE_LIST_KEY, 0, jobId);
  }

  private async getQueuePosition(jobId: string) {
    const list = await redisClient.lRange(QUEUE_LIST_KEY, 0, -1);
    const index = list.indexOf(jobId);
    return index === -1 ? 0 : index + 1;
  }

  private async setJobRecord(jobId: string, record: WorkflowJobRecord) {
    await redisClient.set(`${JOB_KEY_PREFIX}${jobId}`, JSON.stringify(record));
  }

  private async updateJob(jobId: string, patch: Partial<WorkflowJobRecord>) {
    const record = await this.getJob(jobId);
    if (!record) return;
    const next: WorkflowJobRecord = {
      ...record,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.setJobRecord(jobId, next);
  }
}

export const workflowQueue = new WorkflowQueue();

export async function initWorkflowQueueConsumers() {
  await workflowQueue.startResultConsumer();
}
