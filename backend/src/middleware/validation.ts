import Joi from 'joi';

const stageResourceSchema = Joi.object({
  type: Joi.string().required(),
  url: Joi.string().uri().required(),
  format: Joi.string().optional(),
  metadata: Joi.object().optional()
});

const GAME_GENRES = [
  'rpg',
  'slg',
  'shooter',
  'moba',
  'act',
  'avg',
  'sim',
  'ftg',
  'rac',
  'sandbox',
  'survival',
  'card',
  'casual',
  'puzzle',
  'rhythm',
  'horror',
];

const GAME_SUB_GENRES = [
  'arpg',
  'turn_based_rpg',
  'mmorpg',
  'turn_based_slg',
  'rts',
  'srpg',
  'fps',
  'tps',
  'rougelike',
  'action_adventure',
  'visual_novel',
  'life_sim',
  'management',
  'driving',
  'open_world',
  'crafting',
  'deck_builder',
  'match3',
  'platform_puzzle',
  'rhythm_action',
  'psychological_horror',
];

const genreSchema = Joi.object({
  primary: Joi.string()
    .valid(...GAME_GENRES)
    .required(),
  subGenre: Joi.string()
    .valid(...GAME_SUB_GENRES)
    .optional(),
  hybrid: Joi.array()
    .items(Joi.string().valid(...GAME_GENRES))
    .max(2)
    .optional(),
});

const stageOverrideSchema = Joi.object({
  stageId: Joi.string().required(),
  agentId: Joi.string().optional(),
  employeeId: Joi.number().integer().optional(),
  model: Joi.string().optional(),
  knowledgeBase: Joi.string().optional(),
  mode: Joi.string().valid('llm+kb', 'llm+custom-kb', 'mcp-local', 'hybrid').optional(),
  tools: Joi.object().optional(),
  mcp: Joi.object({
    endpoint: Joi.string().uri().required(),
    token: Joi.string().optional()
  }).optional(),
  resources: Joi.array().items(stageResourceSchema).optional(),
  expectedArtifacts: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    format: Joi.string().optional()
  })).optional(),
  planningFocus: Joi.object({
    narrative: Joi.boolean().optional(),
    numeric: Joi.boolean().optional(),
    levelDesign: Joi.boolean().optional(),
    systemDesign: Joi.object({
      growth: Joi.boolean().optional(),
      equipment: Joi.boolean().optional(),
      social: Joi.boolean().optional(),
      combat: Joi.boolean().optional(),
    }).optional(),
  }).optional()
});

// 用户注册验证
export const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required()
    .messages({
      'string.empty': '用户名不能为空',
      'string.alphanum': '用户名只能包含字母和数字',
      'string.min': '用户名长度至少为3个字符',
      'string.max': '用户名长度不能超过30个字符',
      'any.required': '用户名是必填项'
    }),
  email: Joi.string().email().required()
    .messages({
      'string.empty': '邮箱不能为空',
      'string.email': '请输入有效的邮箱地址',
      'any.required': '邮箱是必填项'
    }),
  password: Joi.string().min(6).max(128).required()
    .messages({
      'string.empty': '密码不能为空',
      'string.min': '密码长度至少为6个字符',
      'string.max': '密码长度不能超过128个字符',
      'any.required': '密码是必填项'
    })
});

// 用户登录验证
export const loginSchema = Joi.object({
  username: Joi.string().required()
    .messages({
      'string.empty': '用户名不能为空',
      'any.required': '用户名是必填项'
    }),
  password: Joi.string().required()
    .messages({
      'string.empty': '密码不能为空',
      'any.required': '密码是必填项'
    })
});

// 市场交易验证
export const marketTransactionSchema = Joi.object({
  agent_id: Joi.number().integer().positive().required()
    .messages({
      'number.base': '员工ID必须是数字',
      'number.positive': '员工ID必须是正数',
      'any.required': '员工ID是必填项'
    }),
  price: Joi.number().positive().required()
    .messages({
      'number.base': '价格必须是数字',
      'number.positive': '价格必须是正数',
      'any.required': '价格是必填项'
    })
});

// 社区帖子验证
export const communityPostSchema = Joi.object({
  title: Joi.string().min(1).max(200).required()
    .messages({
      'string.empty': '帖子标题不能为空',
      'string.min': '帖子标题长度至少为1个字符',
      'string.max': '帖子标题长度不能超过200个字符',
      'any.required': '帖子标题是必填项'
    }),
  content: Joi.string().min(1).max(5000).required()
    .messages({
      'string.empty': '帖子内容不能为空',
      'string.min': '帖子内容长度至少为1个字符',
      'string.max': '帖子内容长度不能超过5000个字符',
      'any.required': '帖子内容是必填项'
    }),
  post_type: Joi.string().valid('discussion', 'guide', 'showcase', 'question').default('discussion')
    .messages({
      'string.valid': '帖子类型必须是 discussion、guide、showcase 或 question 之一'
    }),
  related_game_id: Joi.number().integer().positive().optional()
    .messages({
      'number.base': '相关游戏ID必须是数字'
    }),
  related_company_id: Joi.number().integer().positive().optional()
    .messages({
      'number.base': '相关公司ID必须是数字'
    })
});

// 公司创建验证（补充）
export const companyCreationSchema = Joi.object({
   name: Joi.string().min(2).max(100).required()
     .messages({
       'string.empty': '公司名称不能为空',
       'string.min': '公司名称长度至少为2个字符',
       'string.max': '公司名称长度不能超过100个字符',
       'any.required': '公司名称是必填项'
     }),
   description: Joi.string().max(500).optional()
     .messages({
       'string.max': '公司描述长度不能超过500个字符'
     }),
   max_employees: Joi.number().integer().min(1).max(100).required()
     .messages({
       'number.base': '最大员工数必须是整数',
       'number.min': '最大员工数不能少于1人',
       'number.max': '最大员工数不能超过100人',
       'any.required': '最大员工数是必填项'
     }),
   workflow_type: Joi.string().valid('linear', 'feedback', 'concurrent').required()
     .messages({
       'string.valid': '工作流程类型必须是 linear、feedback 或 concurrent 之一',
       'any.required': '工作流程类型是必填项'
     }),
   initial_capital: Joi.number().integer().min(100).max(100000).required()
     .messages({
       'number.base': '初始资金必须是整数',
       'number.min': '初始资金不能少于100游戏币',
       'number.max': '初始资金不能超过100000游戏币',
       'any.required': '初始资金是必填项'
    }),
   workflow_config: Joi.object({
     workflowId: Joi.string().optional(),
     executionMode: Joi.string().valid('sequential','async_parallel','feedback_loop').optional(),
     cloudProvider: Joi.string().valid('aliyun','gcp').optional(),
     knowledgeBase: Joi.string().optional(),
     callbacks: Joi.object({
       webhook: Joi.string().uri().optional(),
       events: Joi.string().valid('ws','sse').optional()
     }).optional(),
     stages: Joi.array().items(stageOverrideSchema).optional()
   }).optional()
 });

export const workflowExecutionSchema = Joi.object({
  project: Joi.object({
    projectName: Joi.string().min(2).max(100).required(),
    genre: genreSchema.required(),
    dimension: Joi.string().valid('2d','3d').required(),
    artStyle: Joi.string().min(2).max(50).required(),
    gameMode: Joi.string().valid('singleplayer','multiplayer').required(),
    additionalRequirements: Joi.string().max(1000).optional()
  }).required(),
  executionMode: Joi.string().valid('sequential','async_parallel','feedback_loop').optional(),
  cloudProvider: Joi.string().valid('aliyun','gcp').optional(),
  workflowId: Joi.string().optional(),
  stages: Joi.array().items(stageOverrideSchema).optional(),
  resources: Joi.object().pattern(Joi.string(), Joi.array().items(stageResourceSchema)).optional(),
  callbacks: Joi.object({
    webhook: Joi.string().uri().optional(),
    events: Joi.string().valid('ws','sse').optional()
  }).optional()
 });

// 员工Agent创建验证
export const agentCreationSchema = Joi.object({
   name: Joi.string().min(2).max(50).required()
     .messages({
       'string.empty': '员工姓名不能为空',
       'string.min': '员工姓名长度至少为2个字符',
       'string.max': '员工姓名长度不能超过50个字符',
       'any.required': '员工姓名是必填项'
     }),
   type: Joi.string().valid('planner', 'artist', 'developer', 'tester', 'operator').required()
     .messages({
       'string.valid': '员工类型必须是 planner、artist、developer、tester 或 operator 之一',
       'any.required': '员工类型是必填项'
     }),
   specialization: Joi.string().max(100).required()
     .messages({
       'string.empty': '专业方向不能为空',
       'string.max': '专业方向长度不能超过100个字符',
       'any.required': '专业方向是必填项'
     }),
   skills: Joi.array().items(Joi.string()).max(10).optional()
     .messages({
       'array.max': '技能数量不能超过10个'
     }),
   experience: Joi.number().integer().min(0).max(50).required()
     .messages({
       'number.base': '工作经验必须是整数',
       'number.min': '工作经验不能少于0年',
       'number.max': '工作经验不能超过50年',
       'any.required': '工作经验是必填项'
     }),
   education: Joi.string().max(100).optional()
     .messages({
       'string.max': '教育背景长度不能超过100个字符'
     }),
   traits: Joi.array().items(Joi.string()).max(5).optional()
     .messages({
       'array.max': '特质数量不能超过5个'
     }),
   salary_requirement: Joi.number().integer().min(10).max(10000).required()
     .messages({
       'number.base': '薪资要求必须是整数',
       'number.min': '薪资要求不能少于10游戏币',
       'number.max': '薪资要求不能超过10000游戏币',
       'any.required': '薪资要求是必填项'
     }),
   company_id: Joi.number().integer().positive().optional()
     .messages({
       'number.base': '公司ID必须是正整数'
     })
 });

// 员工Agent更新验证
export const agentUpdateSchema = Joi.object({
   name: Joi.string().min(2).max(50).optional()
     .messages({
       'string.empty': '员工姓名不能为空',
       'string.min': '员工姓名长度至少为2个字符',
       'string.max': '员工姓名长度不能超过50个字符'
     }),
   specialization: Joi.string().max(100).optional()
     .messages({
       'string.empty': '专业方向不能为空',
       'string.max': '专业方向长度不能超过100个字符'
     }),
   skills: Joi.array().items(Joi.string()).max(10).optional()
     .messages({
       'array.max': '技能数量不能超过10个'
     }),
   traits: Joi.array().items(Joi.string()).max(5).optional()
     .messages({
       'array.max': '特质数量不能超过5个'
     }),
   salary_requirement: Joi.number().integer().min(10).max(10000).optional()
     .messages({
       'number.base': '薪资要求必须是整数',
       'number.min': '薪资要求不能少于10游戏币',
       'number.max': '薪资要求不能超过10000游戏币'
     })
 });

// 验证中间件
export function validate(schema: Joi.Schema) {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        error: '参数验证失败',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    req.body = value;
    next();
  };
}

// 导出验证中间件
export const validateUserRegistration = validate(registerSchema);
export const validateUserLogin = validate(loginSchema);
export const validateCompanyCreation = validate(companyCreationSchema);
export const validateAgentCreation = validate(agentCreationSchema);
export const validateAgentUpdate = validate(agentUpdateSchema);
export const validateWorkflowExecution = validate(workflowExecutionSchema);

// 市场列表创建验证
const marketListingSchema = Joi.object({
  employeeId: Joi.number().integer().positive().required()
    .messages({
      'number.base': '员工ID必须是数字',
      'number.positive': '员工ID必须是正数',
      'any.required': '员工ID不能为空'
    }),
  price: Joi.number().positive().required()
    .messages({
      'number.base': '价格必须是数字',
      'number.positive': '价格必须是正数',
      'any.required': '价格不能为空'
    }),
  description: Joi.string().max(500).optional()
    .messages({
      'string.base': '描述必须是字符串',
      'string.max': '描述不能超过500个字符'
    })
});

export const validateMarketListing = validate(marketListingSchema);

// 社区帖子创建验证
const communityPostCreateSchema = Joi.object({
  title: Joi.string().min(1).max(200).required()
    .messages({
      'string.base': '标题必须是字符串',
      'string.min': '标题至少需要1个字符',
      'string.max': '标题不能超过200个字符',
      'any.required': '标题不能为空'
    }),
  content: Joi.string().min(1).max(5000).required()
    .messages({
      'string.base': '内容必须是字符串',
      'string.min': '内容至少需要1个字符',
      'string.max': '内容不能超过5000个字符',
      'any.required': '内容不能为空'
    }),
  type: Joi.string().valid('share', 'question', 'discussion').required()
    .messages({
      'string.base': '类型必须是字符串',
      'any.only': '类型必须是 share、question 或 discussion',
      'any.required': '类型不能为空'
    }),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
    .messages({
      'array.base': '标签必须是数组',
      'array.max': '标签不能超过10个',
      'string.max': '单个标签不能超过50个字符'
    }),
  gameId: Joi.number().integer().positive().optional()
    .messages({
      'number.base': '游戏ID必须是数字',
      'number.positive': '游戏ID必须是正数'
    })
});

// 社区评论创建验证
const communityCommentSchema = Joi.object({
  content: Joi.string().min(1).max(1000).required()
    .messages({
      'string.base': '评论内容必须是字符串',
      'string.min': '评论内容至少需要1个字符',
      'string.max': '评论内容不能超过1000个字符',
      'any.required': '评论内容不能为空'
    }),
  parentId: Joi.number().integer().positive().optional()
    .messages({
      'number.base': '父评论ID必须是数字',
      'number.positive': '父评论ID必须是正数'
    })
});

export const validatePostCreation = validate(communityPostCreateSchema);
export const validateCommentCreation = validate(communityCommentSchema);