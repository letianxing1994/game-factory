export type ExecutionMode = 'sequential' | 'async_parallel' | 'feedback_loop';

export type GameGenre =
  | 'rpg'
  | 'slg'
  | 'shooter'
  | 'moba'
  | 'act'
  | 'avg'
  | 'sim'
  | 'ftg'
  | 'rac'
  | 'sandbox'
  | 'survival'
  | 'card'
  | 'casual'
  | 'puzzle'
  | 'rhythm'
  | 'horror';

export type GameSubGenre =
  | 'arpg'
  | 'turn_based_rpg'
  | 'mmorpg'
  | 'turn_based_slg'
  | 'rts'
  | 'srpg'
  | 'fps'
  | 'tps'
  | 'rougelike'
  | 'action_adventure'
  | 'visual_novel'
  | 'life_sim'
  | 'management'
  | 'driving'
  | 'open_world'
  | 'crafting'
  | 'deck_builder'
  | 'match3'
  | 'platform_puzzle'
  | 'rhythm_action'
  | 'psychological_horror';

export interface GameGenreInput {
  primary: GameGenre;
  subGenre?: GameSubGenre;
  hybrid?: GameGenre[];
}

export interface StageResource {
  type: string;
  url: string;
  format?: string;
  metadata?: Record<string, any>;
}

export interface StageConfigInput {
  stageId: string;
  agentId: string;
  model: string;
  knowledgeBase?: string;
  mode?: 'llm+kb' | 'llm+custom-kb' | 'mcp-local' | 'hybrid';
  tools?: Record<string, any>;
  mcp?: {
    endpoint: string;
    token?: string;
  };
  resources?: StageResource[];
  expectedArtifacts?: Array<{ type: string; format?: string }>;
  planningFocus?: PlanningFocusConfig;
}

export interface ExecutionRequestInput {
  workflowId: string;
  executionMode: ExecutionMode;
  cloudProvider: 'aliyun' | 'gcp';
  project: {
    projectName: string;
    genre: GameGenreInput;
    gameType?: GameGenre;
    dimension: '2d' | '3d';
    artStyle: string;
    gameMode: 'singleplayer' | 'multiplayer';
    additionalRequirements?: string;
  };
  stages: StageConfigInput[];
  callbacks?: {
    webhook?: string;
    events?: 'ws' | 'sse';
  };
}

export interface PlanningFocusConfig {
  narrative?: boolean;
  numeric?: boolean;
  levelDesign?: boolean;
  systemDesign?: {
    growth?: boolean;
    equipment?: boolean;
    social?: boolean;
    combat?: boolean;
  };
}

export type WorkflowJobStatus =
  | 'queued'
  | 'running'
  | 'clarifying'
  | 'completed'
  | 'failed';

export interface WorkflowJobRecord {
  jobId: string;
  companyId: number;
  ownerId: number;
  status: WorkflowJobStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
  executionId?: string;
  projectId?: string;
  error?: string;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
  etaMs?: number;
  payload: ExecutionRequestInput;
}

export interface WorkflowTaskMessage {
  jobId: string;
  companyId: number;
  ownerId: number;
  payload: ExecutionRequestInput;
  enqueuedAt: string;
}

export interface WorkflowResultMessage {
  jobId: string;
  status: WorkflowJobStatus;
  executionId?: string;
  projectId?: string;
  workflowId?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  message?: string;
}

