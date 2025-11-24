import {
  ExecutionRequestInput,
  StageConfigInput,
  PlanningFocusConfig,
  GameGenreInput,
  StageResource,
} from '../types/workflow';

export const WORKFLOW_MAP = {
  linear: { workflowId: 'sequential-game-dev', executionMode: 'sequential' },
  feedback: { workflowId: 'feedback-loop-game-dev', executionMode: 'feedback_loop' },
  concurrent: { workflowId: 'parallel-game-dev', executionMode: 'async_parallel' },
};

export const DEFAULT_STAGE_BLUEPRINT: Array<{ stageId: string; agentId: string; requiredType: string }> = [
  { stageId: 'planning', agentId: 'planning-agent', requiredType: 'planner' },
  { stageId: 'art', agentId: 'art-agent', requiredType: 'artist' },
  { stageId: 'music', agentId: 'music-agent', requiredType: 'music' },
  { stageId: 'architecture', agentId: 'architecture-agent', requiredType: 'architect' },
  { stageId: 'tech', agentId: 'tech-agent', requiredType: 'developer' },
  { stageId: 'test', agentId: 'test-agent', requiredType: 'tester' },
];

/**
 * 根据工作流类型调整阶段蓝图
 * - waterfall (linear): planning -> art -> music -> architecture -> tech -> test (严格顺序)
 * - agile (concurrent): planning -> (art + music + architecture 并行) -> tech -> test
 * - hybrid (feedback): planning -> architecture -> (art + music + tech 并行) -> test (支持反馈循环)
 */
function adjustStagesByWorkflowType(
  baseBlueprint: any[],
  workflowType: string,
  executionMode: string,
): any[] {
  // 如果用户自定义了阶段，直接返回
  if (baseBlueprint !== DEFAULT_STAGE_BLUEPRINT) {
    return baseBlueprint;
  }

  const blueprint = [...baseBlueprint];

  // 根据执行模式调整阶段依赖和顺序
  switch (executionMode) {
    case 'sequential':
      // 瀑布流：严格按顺序执行
      return blueprint.map((stage, index) => ({
        ...stage,
        dependencies: index > 0 ? [blueprint[index - 1].stageId] : undefined,
      }));

    case 'async_parallel':
      // 敏捷模式：策划完成后，美术/音乐/架构师并行，然后研发和测试
      return blueprint.map((stage) => {
        if (stage.stageId === 'planning') {
          return stage;
        } else if (['art', 'music', 'architecture'].includes(stage.stageId)) {
          return { ...stage, dependencies: ['planning'] };
        } else if (stage.stageId === 'tech') {
          return { ...stage, dependencies: ['architecture'] };
        } else if (stage.stageId === 'test') {
          return { ...stage, dependencies: ['tech'] };
        }
        return stage;
      });

    case 'feedback_loop':
      // 混合模式：策划 -> 架构师 -> (美术/音乐/研发 并行) -> 测试
      return blueprint.map((stage) => {
        if (stage.stageId === 'planning') {
          return stage;
        } else if (stage.stageId === 'architecture') {
          return { ...stage, dependencies: ['planning'] };
        } else if (['art', 'music', 'tech'].includes(stage.stageId)) {
          return { ...stage, dependencies: ['architecture'], allowFeedback: true };
        } else if (stage.stageId === 'test') {
          return { ...stage, dependencies: ['tech'], allowFeedback: true };
        }
        return stage;
      });

    default:
      return blueprint;
  }
}

// 必需的员工类型
const REQUIRED_AGENT_TYPES = ['planner', 'architect', 'artist', 'developer', 'tester', 'music'];

export function buildExecutionRequest(
  company: any,
  employees: any[],
  body: any,
  companyWorkflowConfig: any,
): ExecutionRequestInput {
  // 验证必需的员工类型
  const employeeTypes = new Set(employees.map(e => e.type));
  const missingTypes = REQUIRED_AGENT_TYPES.filter(type => !employeeTypes.has(type));
  
  if (missingTypes.length > 0) {
    const typeNameMap: Record<string, string> = {
      planner: '策划',
      architect: '架构师',
      artist: '美术',
      developer: '研发',
      tester: '测试',
      music: '音频'
    };
    const missingNames = missingTypes.map(t => typeNameMap[t] || t).join('、');
    throw new Error(`公司缺少必需的员工类型: ${missingNames}。请先雇佣这些类型的员工。`);
  }

  const workflowMeta =
    companyWorkflowConfig?.workflow ||
    WORKFLOW_MAP[company.workflow_type as keyof typeof WORKFLOW_MAP] ||
    WORKFLOW_MAP.linear;

  const executionMode =
    body.executionMode || companyWorkflowConfig?.executionMode || workflowMeta.executionMode;

  const cloudProvider = body.cloudProvider || companyWorkflowConfig?.cloudProvider || 'aliyun';

  const workflowId = body.workflowId || companyWorkflowConfig?.workflowId || workflowMeta.workflowId;

  const baseBlueprints =
    body.stages || companyWorkflowConfig?.stages || DEFAULT_STAGE_BLUEPRINT;
  
  // 根据工作流类型调整阶段蓝图
  const stageBlueprints = adjustStagesByWorkflowType(
    baseBlueprints,
    company.workflow_type,
    executionMode,
  );

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

    // 架构师阶段特殊配置：追踪美术和音频资产
    if (stage.stageId === 'architecture') {
      stageConfig.expectedArtifacts = stageConfig.expectedArtifacts || [
        { type: 'architecture-doc', format: 'markdown' },
        { type: 'tech-stack', format: 'json' },
        { type: 'api-design', format: 'json' },
      ];
      
      // 架构师阶段的资源包括策划文档和可选的美术/音乐资源
      const architectureResources: StageResource[] = [];
      
      // 添加策划阶段输出作为输入资源
      architectureResources.push({
        type: 'planning-doc',
        url: 'stage://planning/output',
        metadata: { required: true },
      });
      
      // 如果存在美术和音乐阶段，追踪它们的产物
      if (stageBlueprints.some((s: any) => s.stageId === 'art')) {
        architectureResources.push({
          type: 'art-assets',
          url: 'stage://art/output',
          metadata: { optional: true, trackChanges: true },
        });
      }
      
      if (stageBlueprints.some((s: any) => s.stageId === 'music')) {
        architectureResources.push({
          type: 'music-assets',
          url: 'stage://music/output',
          metadata: { optional: true, trackChanges: true },
        });
      }
      
      // 合并用户提供的资源
      stageConfig.resources = mergeResources(architectureResources, stageConfig.resources);
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
    case 'music':
      return 'music';
    case 'architect':
      return 'architecture';
    case 'developer':
      return 'tech';
    case 'tester':
      return 'test';
    default:
      return 'planning';
  }
}

