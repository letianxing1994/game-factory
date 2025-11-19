import {
  ExecutionRequestInput,
  StageConfigInput,
  PlanningFocusConfig,
  GameGenreInput,
} from '../types/workflow';

export const WORKFLOW_MAP = {
  linear: { workflowId: 'sequential-game-dev', executionMode: 'sequential' },
  feedback: { workflowId: 'feedback-loop-game-dev', executionMode: 'feedback_loop' },
  concurrent: { workflowId: 'parallel-game-dev', executionMode: 'async_parallel' },
};

export const DEFAULT_STAGE_BLUEPRINT: Array<{ stageId: string; agentId: string; requiredType: string }> = [
  { stageId: 'planning', agentId: 'planning-agent', requiredType: 'planner' },
  { stageId: 'art', agentId: 'art-agent', requiredType: 'artist' },
  { stageId: 'music', agentId: 'music-agent', requiredType: 'artist' },
  { stageId: 'tech', agentId: 'tech-agent', requiredType: 'developer' },
  { stageId: 'test', agentId: 'test-agent', requiredType: 'tester' },
];

export function buildExecutionRequest(
  company: any,
  employees: any[],
  body: any,
  companyWorkflowConfig: any,
): ExecutionRequestInput {
  const workflowMeta =
    companyWorkflowConfig?.workflow ||
    WORKFLOW_MAP[company.workflow_type as keyof typeof WORKFLOW_MAP] ||
    WORKFLOW_MAP.linear;

  const executionMode =
    body.executionMode || companyWorkflowConfig?.executionMode || workflowMeta.executionMode;

  const cloudProvider = body.cloudProvider || companyWorkflowConfig?.cloudProvider || 'aliyun';

  const workflowId = body.workflowId || companyWorkflowConfig?.workflowId || workflowMeta.workflowId;

  const stageBlueprints =
    body.stages || companyWorkflowConfig?.stages || DEFAULT_STAGE_BLUEPRINT;

  const normalizedEmployees = employees.map(deserializeEmployee);

  const stageConfigs = stageBlueprints.map((stage: any) => {
    const assignedEmployee = stage.employeeId
      ? normalizedEmployees.find((e) => e.id === stage.employeeId)
      : normalizedEmployees.find((e) => e.type === (stage.requiredType || stage.role));

    const model =
      stage.model ||
      assignedEmployee?.ai_model ||
      process.env[`DEFAULT_MODEL_${stage.stageId?.toUpperCase?.()}`] ||
      'default-model';

    if (!model) {
      throw new Error(`阶段 ${stage.stageId} 缺少可用模型或员工`);
    }

    const stageConfig: StageConfigInput = {
      stageId: stage.stageId,
      agentId: stage.agentId || `${stage.stageId}-agent`,
      model,
      knowledgeBase: stage.knowledgeBase || companyWorkflowConfig?.knowledgeBase,
      mode: stage.mode || 'llm+kb',
      tools: stage.tools || {},
      mcp: stage.mcp,
      resources: mergeResources(stage.resources, body.resources?.[stage.stageId]),
      expectedArtifacts: stage.expectedArtifacts,
      // 新增：传递agent的专业和额外特点
      agentMeta: assignedEmployee ? {
        dimension: assignedEmployee.dimension,
        specialization: assignedEmployee.specialization,
        extraTraits: assignedEmployee.extra_traits,
      } : undefined,
    };

    if (stage.stageId === 'planning') {
      const mergedFocus = mergePlanningFocus(
        stage.planningFocus,
        derivePlanningFocusFromSpecialization(assignedEmployee),
        derivePlanningFocusFromGenre(body.project?.genre),
      );
      if (mergedFocus) {
        stageConfig.planningFocus = mergedFocus;
      }
    }

    return stageConfig;
  });

  return {
    workflowId,
    executionMode,
    cloudProvider,
    project: body.project,
    stages: stageConfigs,
    callbacks: body.callbacks || companyWorkflowConfig?.callbacks,
  };
}

function mergeResources(...resourceGroups: any[]): StageConfigInput['resources'] {
  const merged: StageConfigInput['resources'] = [];
  resourceGroups.forEach((group) => {
    if (Array.isArray(group)) {
      group.forEach((item) => merged.push(item));
    }
  });
  return merged.length ? merged : undefined;
}

function deserializeEmployee(employee: any) {
  return {
    ...employee,
  };
}

function derivePlanningFocusFromSpecialization(employee?: any): PlanningFocusConfig | undefined {
  if (!employee || !employee.specialization) return undefined;
  
  // 从specialization字段推导planning focus（策划agent的specialization表示擅长的游戏品类）
  const spec = employee.specialization.toLowerCase();
  
  // 根据specialization映射到对应的游戏类型，然后调用derivePlanningFocusFromGenre
  let genreMapping: { primary: string } | undefined;
  
  if (spec === 'rpg') genreMapping = { primary: 'rpg' };
  else if (spec === 'moba') genreMapping = { primary: 'moba' };
  else if (spec === 'shooter') genreMapping = { primary: 'shooter' };
  else if (spec === 'slg') genreMapping = { primary: 'slg' };
  else if (spec === 'card') genreMapping = { primary: 'card' };
  else if (spec === 'sandbox') genreMapping = { primary: 'sandbox' };
  else if (spec === 'casual') genreMapping = { primary: 'casual' };
  
  if (genreMapping) {
    return derivePlanningFocusFromGenre(genreMapping as GameGenreInput);
  }
  
  return undefined;
}

function derivePlanningFocusFromGenre(genre?: GameGenreInput): PlanningFocusConfig | undefined {
  const primary = genre?.primary;
  if (!primary) return undefined;
  switch (primary) {
    case 'rpg':
      return {
        narrative: true,
        levelDesign: true,
        systemDesign: { growth: true, equipment: true, combat: true },
      };
    case 'moba':
      return {
        numeric: true,
        systemDesign: { combat: true, social: true },
      };
    case 'shooter':
      return {
        systemDesign: { combat: true },
        levelDesign: true,
      };
    case 'slg':
      return {
        numeric: true,
        systemDesign: { growth: true, social: true },
      };
    case 'card':
      return {
        narrative: true,
        numeric: true,
      };
    case 'sandbox':
    case 'survival':
      return {
        levelDesign: true,
        systemDesign: {
          growth: true,
          social: primary === 'sandbox',
          combat: primary === 'survival',
        },
      };
    default:
      return undefined;
  }
}

function mergePlanningFocus(
  ...focuses: Array<PlanningFocusConfig | undefined>
): PlanningFocusConfig | undefined {
  const merged: PlanningFocusConfig = {};
  for (const focus of focuses) {
    if (!focus) continue;
    if (focus.narrative) merged.narrative = true;
    if (focus.numeric) merged.numeric = true;
    if (focus.levelDesign) merged.levelDesign = true;
    if (focus.systemDesign) {
      merged.systemDesign = merged.systemDesign || {};
      merged.systemDesign.growth = merged.systemDesign.growth || focus.systemDesign.growth;
      merged.systemDesign.equipment =
        merged.systemDesign.equipment || focus.systemDesign.equipment;
      merged.systemDesign.social = merged.systemDesign.social || focus.systemDesign.social;
      merged.systemDesign.combat = merged.systemDesign.combat || focus.systemDesign.combat;
    }
  }
  return hasPlanningFocus(merged) ? merged : undefined;
}

function hasPlanningFocus(focus?: PlanningFocusConfig) {
  if (!focus) return false;
  if (focus.narrative || focus.numeric || focus.levelDesign) return true;
  if (focus.systemDesign) {
    return Object.values(focus.systemDesign).some(Boolean);
  }
  return false;
}

export function mapAgentTypeToStage(type: string) {
  switch (type) {
    case 'planner':
      return 'planning';
    case 'artist':
      return 'art';
    case 'developer':
      return 'tech';
    case 'tester':
      return 'test';
    default:
      return 'planning';
  }
}

