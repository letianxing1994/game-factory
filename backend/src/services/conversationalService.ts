import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface FunctionCallResult {
  reply?: string;
  functionCall?: {
    name: string;
    arguments: string;
  };
  shouldExecute: boolean;
}

// 公司创建的函数定义
const createCompanyFunctionDef = {
  name: 'create_company',
  description: '创建一个新的游戏公司',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '公司名称，2-100个字符',
      },
      description: {
        type: 'string',
        description: '公司简介（可选），最多500个字符',
      },
      maxEmployees: {
        type: 'number',
        description: '最大员工数，1-100之间',
      },
      workflowType: {
        type: 'string',
        enum: ['linear', 'feedback', 'concurrent'],
        description: 'linear: 瀑布流严格顺序执行，feedback: 支持反馈循环，concurrent: 敏捷并行',
      },
      initialCapital: {
        type: 'number',
        description: '初始资金，100-100000游戏币',
      },
    },
    required: ['name', 'maxEmployees', 'workflowType', 'initialCapital'],
  },
};

// 员工雇佣的函数定义
const createAgentFunctionDef = {
  name: 'create_agent',
  description: '为游戏公司雇佣一个新的AI员工',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: '员工姓名，2-50个字符',
      },
      type: {
        type: 'string',
        enum: ['planner', 'architect', 'artist', 'developer', 'tester', 'music'],
        description: 'planner: 策划, architect: 架构师, artist: 美术, developer: 研发, tester: 测试, music: 音频',
      },
      dimension: {
        type: 'string',
        enum: ['2d', '3d'],
        description: '维度：2d 或 3d',
      },
      specialization: {
        type: 'string',
        description: '专长领域，例如：RPG、MOBA、关卡设计等',
      },
      ai_model: {
        type: 'string',
        description: '使用的AI模型，例如：gpt-4、claude-3-5-sonnet等',
      },
      extra_traits: {
        type: 'string',
        description: '额外特点（可选），最多200个字符',
      },
    },
    required: ['name', 'type', 'dimension', 'specialization', 'ai_model'],
  },
};

export class ConversationalService {
  private openaiClient: OpenAI | null = null;
  private deepseekClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    if (process.env.DEEPSEEK_API_KEY) {
      this.deepseekClient = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      });
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  async processCompanyCreation(
    model: string,
    messages: Message[],
    context?: { phase: 'company' | 'employees'; companyId?: number; createdEmployees?: string[] },
  ): Promise<FunctionCallResult & { phase?: 'company' | 'employees' }> {
    const phase = context?.phase || 'company';
    const functionDef = phase === 'company' ? createCompanyFunctionDef : createAgentFunctionDef;

    let result: FunctionCallResult;
    if (model.startsWith('gpt') || model.startsWith('deepseek')) {
      result = await this.processOpenAIStyleChat(model, messages, functionDef);
    } else if (model.startsWith('claude')) {
      result = await this.processAnthropicChat(model, messages, functionDef);
    } else if (model.startsWith('gemini')) {
      throw new Error('Gemini 模型暂未实现');
    } else {
      throw new Error('不支持的模型');
    }

    return { ...result, phase };
  }

  async processAgentCreation(
    model: string,
    messages: Message[],
  ): Promise<FunctionCallResult> {
    if (model.startsWith('gpt') || model.startsWith('deepseek')) {
      return this.processOpenAIStyleChat(model, messages, createAgentFunctionDef);
    } else if (model.startsWith('claude')) {
      return this.processAnthropicChat(model, messages, createAgentFunctionDef);
    } else if (model.startsWith('gemini')) {
      throw new Error('Gemini 模型暂未实现');
    } else {
      throw new Error('不支持的模型');
    }
  }

  private async processOpenAIStyleChat(
    model: string,
    messages: Message[],
    functionDef: any,
  ): Promise<FunctionCallResult> {
    // 选择合适的客户端
    let client: OpenAI | null = null;
    let modelName = model;

    if (model.startsWith('deepseek')) {
      client = this.deepseekClient;
      if (!client) {
        throw new Error('DeepSeek API key 未配置');
      }
      modelName = 'deepseek-chat';
    } else {
      client = this.openaiClient;
      if (!client) {
        throw new Error('OpenAI API key 未配置');
      }
    }

    const systemMessage = {
      role: 'system' as const,
      content:
        '你是一个游戏公司管理助手。用户会告诉你他们想要创建的公司或雇佣的员工信息。你需要收集所有必需的信息，然后调用相应的函数来完成操作。如果信息不完整，请询问用户。',
    };

    const response = await client.chat.completions.create({
      model: modelName,
      messages: [systemMessage, ...messages] as any,
      tools: [
        {
          type: 'function',
          function: functionDef,
        },
      ],
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    const toolCall = choice.message.tool_calls?.[0];

    if (toolCall && toolCall.type === 'function') {
      return {
        functionCall: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
        shouldExecute: true,
      };
    } else if (choice.message.content) {
      return {
        reply: choice.message.content,
        shouldExecute: false,
      };
    } else {
      return {
        reply: '对不起，我没有理解您的意思，请再说一次。',
        shouldExecute: false,
      };
    }
  }

  private async processAnthropicChat(
    model: string,
    messages: Message[],
    functionDef: any,
  ): Promise<FunctionCallResult> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic API key 未配置');
    }

    const systemMessage =
      '你是一个游戏公司管理助手。用户会告诉你他们想要创建的公司或雇佣的员工信息。你需要收集所有必需的信息，然后调用相应的函数来完成操作。如果信息不完整，请询问用户。';

    const response = await this.anthropicClient.messages.create({
      model: model,
      max_tokens: 1024,
      system: systemMessage,
      messages: messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
      tools: [
        {
          name: functionDef.name,
          description: functionDef.description,
          input_schema: functionDef.parameters,
        },
      ],
    });

    const content = response.content;
    const toolUse = content.find((c) => c.type === 'tool_use');

    if (toolUse && toolUse.type === 'tool_use') {
      return {
        functionCall: {
          name: toolUse.name,
          arguments: JSON.stringify(toolUse.input),
        },
        shouldExecute: true,
      };
    } else {
      const textContent = content.find((c) => c.type === 'text');
      return {
        reply: textContent && textContent.type === 'text' ? textContent.text : '请提供更多信息',
        shouldExecute: false,
      };
    }
  }
}

export const conversationalService = new ConversationalService();
