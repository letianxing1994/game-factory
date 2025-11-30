// 用户类型
export interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  reputation: number;
  createdAt: string;
}

// 游戏币类型
export interface CoinTransaction {
  id: number;
  type: 'recharge' | 'transfer' | 'game_reward' | 'agent_purchase' | 'agent_sale';
  amount: number;
  description: string;
  createdAt: string;
}

// 公司类型
export interface Company {
  id: number;
  name: string;
  description: string;
  maxEmployees: number;
  currentEmployees: number;
  workflowType: 'agile' | 'waterfall' | 'hybrid';
  initialCapital: number;
  currentCapital: number;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

// 员工Agent类型
export interface EmployeeAgent {
  id: number;
  name: string;
  type: 'planner' | 'architect' | 'artist' | 'developer' | 'tester' | 'operator' | 'music';
  dimension?: '2d' | '3d'; // 仅美术类型需要，区分2D/3D美术
  ai_model?: string; // AI模型名称（非美术或向后兼容）
  ai_model_2d?: string; // 2D模型（用于贴图/原画）
  ai_model_3d?: string; // 3D模型（用于3D资产生成）
  specialization: string;
  extra_traits?: string; // 额外特点
  status: 'employed' | 'available';
  owner_id: number;
  company_id?: number;
  company_name?: string;
  created_at: string;
  updated_at: string;
}

// 市场列表类型
export interface MarketListing {
  id: number;
  price: number;
  listingDescription: string;
  listingCreatedAt: string;
  agentId: number;
  agentName: string;
  agentType: string;
  dimension?: string;
  ai_model?: string;
  specialization: string;
  extra_traits?: string;
  sellerId: number;
  sellerName: string;
}

// 社区帖子类型
export interface CommunityPost {
  id: number;
  title: string;
  content: string;
  type: 'share' | 'question' | 'discussion';
  tags: string[];
  gameId?: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  username: string;
  avatar?: string;
  likeCount: number;
  commentCount: number;
}

// 社区评论类型
export interface CommunityComment {
  id: number;
  content: string;
  parentId?: number;
  createdAt: string;
  updatedAt: string;
  userId: number;
  username: string;
  avatar?: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 表单类型
export interface LoginForm {
  username: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface CompanyForm {
  name: string;
  description: string;
  maxEmployees: number;
  workflowType: 'agile' | 'waterfall' | 'hybrid';
  initialCapital: number;
}

export interface AgentForm {
  name: string;
  type: 'planner' | 'artist' | 'developer' | 'tester' | 'operator';
  specialization: string;
  skills: string[];
  experience: number;
  education: string;
  traits: string[];
  salaryRequirement: number;
}

export interface MarketListingForm {
  employeeId: number;
  price: number;
  description: string;
}

export interface CommunityPostForm {
  title: string;
  content: string;
  type: 'share' | 'question' | 'discussion';
  tags: string[];
  gameId?: number;
}

export interface WorkflowStageStatus {
  stageId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  startedAt?: string;
  completedAt?: string;
  artifacts?: string[];
  notes?: string;
}

export interface WorkflowJobState {
  jobId: string;
  status: 'queued' | 'running' | 'clarifying' | 'completed' | 'failed';
  position: number;
  etaMs?: number;
  executionId?: string;
  projectId?: string;
  companyId?: number;
  ownerId?: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  message?: string;
  stages?: WorkflowStageStatus[];
}

export interface ClarificationQuestion {
  questionId: string;
  question: string;
  stageId?: string;
  category?: string;
  status: 'open' | 'answered';
  answer?: string;
  context?: Record<string, any>;
  createdAt: string;
}

export interface ClarificationConversationEntry {
  messageId: string;
  role: 'orchestrator' | 'user' | 'agent';
  type: 'question' | 'answer' | 'update';
  content: string;
  stageId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ClarificationState {
  status: 'idle' | 'pending' | 'resolved';
  questions: ClarificationQuestion[];
  conversation: ClarificationConversationEntry[];
}

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

export interface GameGenreSelection {
  primary: GameGenre;
  subGenre?: GameSubGenre;
  hybrid?: GameGenre[];
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

export interface WorkflowCapacity {
  concurrency: number;
  running: number;
  queued: number;
  avgDurationMs: number;
}

export interface AgentPreviewResult {
  stageId: string;
  status?: string;
  artifacts?: Array<{
    artifactId?: string;
    type: string;
    format?: string;
    url: string;
    metadata?: Record<string, any>;
  }>;
}

// 预览任务类型
export interface PreviewTask {
  id: number;
  task_id: string;
  user_id: number;
  agent_id: number;
  agent_name?: string;
  task_name: string;
  game_id?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  stage_id: string;
  start_time?: string;
  complete_time?: string;
  result_data?: any;
  error_message?: string;
  config?: any;
  created_at: string;
  updated_at: string;
}

// 创建预览任务请求
export interface CreatePreviewTaskRequest {
  agentId: number;
  taskName: string;
  gameId?: number;
  project: {
    projectName: string;
    description: string;
  };
  cloudProvider?: 'aliyun' | 'gcp';
  stageConfig?: {
    model?: string;
    mode?: string;
  };
  userInput?: Record<string, any>;
}

// 创建预览任务响应
export interface CreatePreviewTaskResponse {
  taskId: string;
  status: string;
  agentId: number;
  stageId: string;
  message: string;
}