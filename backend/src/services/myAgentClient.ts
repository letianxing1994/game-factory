import fetch, { Response } from 'node-fetch';
import logger from '../utils/logger';
import { ExecutionRequestInput, StageConfigInput } from '../types/workflow';

export const MY_AGENT_BASE_URL = process.env.MY_AGENT_BASE_URL || 'http://localhost:8080/api';
const API_KEY = process.env.MY_AGENT_API_KEY || '';

export function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
  };
}

async function handleResponse(response: Response, context: string) {
  if (!response.ok) {
    const text = await response.text();
    logger.error(`${context}失败`, text);
    throw new Error(`${context} failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function submitExecution(payload: ExecutionRequestInput) {
  const response = await fetch(`${MY_AGENT_BASE_URL}/executions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response, '提交workflow');
}

export async function fetchExecution(executionId: string) {
  const response = await fetch(`${MY_AGENT_BASE_URL}/executions/${executionId}`, {
    headers: buildHeaders(),
  });
  return handleResponse(response, '获取执行详情');
}

export async function fetchStageContext(executionId: string, stageId: string) {
  const response = await fetch(`${MY_AGENT_BASE_URL}/executions/${executionId}/stages/${stageId}`, {
    headers: buildHeaders(),
  });
  return handleResponse(response, '获取阶段上下文');
}

export async function controlStage(
  executionId: string,
  stageId: string,
  action: 'pause' | 'resume',
  payload?: Record<string, any>
) {
  const response = await fetch(`${MY_AGENT_BASE_URL}/executions/${executionId}/stages/${stageId}/${action}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload || {}),
  });
  return handleResponse(response, `阶段${action}`);
}

export async function updateStage(
  executionId: string,
  stageId: string,
  payload: { notes?: string; overrides?: StageConfigInput; resources?: Array<{ type: string; url: string }> }
) {
  const response = await fetch(`${MY_AGENT_BASE_URL}/executions/${executionId}/stages/${stageId}/updates`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response, '阶段更新');
}

export async function previewAgentStage(payload: {
  stage: StageConfigInput;
  project: ExecutionRequestInput['project'];
  cloudProvider?: 'aliyun' | 'gcp';
}) {
  const response = await fetch(`${MY_AGENT_BASE_URL}/executions/preview`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response, 'Agent预览');
}

export async function fetchClarifications(executionId: string) {
  const response = await fetch(`${MY_AGENT_BASE_URL}/executions/${executionId}/clarifications`, {
    headers: buildHeaders(),
  });
  return handleResponse(response, '获取澄清信息');
}

export async function submitClarifications(
  executionId: string,
  payload: { responses: Array<{ questionId: string; answer: string }> }
) {
  const response = await fetch(`${MY_AGENT_BASE_URL}/executions/${executionId}/clarifications`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response, '提交澄清信息');
}

