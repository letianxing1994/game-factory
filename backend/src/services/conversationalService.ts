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
        description: '最大员工数，必须是6（游戏公司需要6位核心员工：策划、架构师、美术、研发、测试、音频）',
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

  // 流式处理对话
  async *processCompanyCreationStream(
    model: string,
    messages: Message[],
    context?: { phase: 'company' | 'employees'; companyId?: number; createdEmployees?: string[] },
  ): AsyncGenerator<{ type: 'token' | 'function_call' | 'done'; content?: string; functionCall?: any; phase?: string }> {
    const phase = context?.phase || 'company';
    const functionDef = phase === 'company' ? createCompanyFunctionDef : createAgentFunctionDef;

    if (model.startsWith('gpt') || model.startsWith('deepseek')) {
      yield* this.processOpenAIStyleChatStream(model, messages, functionDef, phase);
    } else if (model.startsWith('claude')) {
      yield* this.processAnthropicChatStream(model, messages, functionDef, phase);
    } else {
      throw new Error('不支持的模型');
    }
  }

  async *processAgentCreationStream(
    model: string,
    messages: Message[],
  ): AsyncGenerator<{ type: 'token' | 'function_call' | 'done'; content?: string; functionCall?: any }> {
    if (model.startsWith('gpt') || model.startsWith('deepseek')) {
      yield* this.processOpenAIStyleChatStream(model, messages, createAgentFunctionDef);
    } else if (model.startsWith('claude')) {
      yield* this.processAnthropicChatStream(model, messages, createAgentFunctionDef);
    } else {
      throw new Error('不支持的模型');
    }
  }

  private async *processOpenAIStyleChatStream(
    model: string,
    messages: Message[],
    functionDef: any,
    phase?: string,
  ): AsyncGenerator<{ type: 'token' | 'function_call' | 'done'; content?: string; functionCall?: any; phase?: string }> {
    let client: OpenAI | null = null;
    let modelName = model;

    if (model.startsWith('deepseek')) {
      client = this.deepseekClient;
      if (!client) throw new Error('DeepSeek API key 未配置');
      modelName = 'deepseek-chat';
    } else {
      client = this.openaiClient;
      if (!client) throw new Error('OpenAI API key 未配置');
    }

    const systemMessage = {
      role: 'system' as const,
      content: '你是一个游戏公司管理助手。用户会告诉你他们想要创建的公司或雇佣的员工信息。你需要收集所有必需的信息，然后调用相应的函数来完成操作。如果信息不完整，请友好地询问用户。回答要简洁专业。',
    };

    const stream = await client.chat.completions.create({
      model: modelName,
      messages: [systemMessage, ...messages] as any,
      tools: [{ type: 'function', function: functionDef }],
      tool_choice: 'auto',
      stream: true,
    });

    let fullContent = '';
    let toolCall: any = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        fullContent += delta.content;
        yield { type: 'token', content: delta.content, phase };
      }

      if (delta?.tool_calls) {
        if (!toolCall) {
          toolCall = { name: '', arguments: '' };
        }
        const tc = delta.tool_calls[0];
        if (tc.function?.name) toolCall.name = tc.function.name;
        if (tc.function?.arguments) toolCall.arguments += tc.function.arguments;
      }
    }

    if (toolCall && toolCall.name) {
      yield { type: 'function_call', functionCall: toolCall, phase };
    }

    yield { type: 'done', phase };
  }

  private async *processAnthropicChatStream(
    model: string,
    messages: Message[],
    functionDef: any,
    phase?: string,
  ): AsyncGenerator<{ type: 'token' | 'function_call' | 'done'; content?: string; functionCall?: any; phase?: string }> {
    if (!this.anthropicClient) throw new Error('Anthropic API key 未配置');

    const systemMessage = '你是一个游戏公司管理助手。用户会告诉你他们想要创建的公司或雇佣的员工信息。你需要收集所有必需的信息，然后调用相应的函数来完成操作。如果信息不完整，请友好地询问用户。回答要简洁专业。';

    const stream = await this.anthropicClient.messages.stream({
      model: model,
      max_tokens: 1024,
      system: systemMessage,
      messages: messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      })),
      tools: [{
        name: functionDef.name,
        description: functionDef.description,
        input_schema: functionDef.parameters,
      }],
    });

    let toolUse: any = null;

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'token', content: event.delta.text, phase };
        } else if (event.delta.type === 'input_json_delta') {
          if (!toolUse) toolUse = { name: '', input: '' };
          toolUse.input += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          toolUse = { name: event.content_block.name, input: '' };
        }
      }
    }

    if (toolUse && toolUse.name) {
      yield { type: 'function_call', functionCall: { name: toolUse.name, arguments: toolUse.input }, phase };
    }

    yield { type: 'done', phase };
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

  // 基于当前对话，向模型请求一个结构化的项目建议（JSON）
  async suggestProject(model: string, messages: Message[]): Promise<any> {
    let client: OpenAI | null = null;
    let modelName = model;

    if (model.startsWith('deepseek')) {
      client = this.deepseekClient;
      if (!client) throw new Error('DeepSeek API key 未配置');
      modelName = 'deepseek-chat';
    } else {
      client = this.openaiClient;
      if (!client) throw new Error('OpenAI API key 未配置');
    }

    const systemMessage = {
      role: 'system' as const,
      content:
        '请基于当前对话上下文为该公司建议一个可执行的游戏项目。非常重要：使用函数调用（tools）返回一个单独的 JSON 对象，且只包含该 JSON，不要输出任何附加文字。JSON 结构如下：' +
        '{"projectName":"string","genre":"string","dimension":"2d|3d","artStyle":"string","additionalRequirements":"string"}。',
    };

    const suggestProjectFunctionDef = {
      name: 'suggest_project',
      description: '返回一个结构化的项目建议，必须只返回一个 JSON 对象',
      parameters: {
        type: 'object',
        properties: {
          projectName: { type: 'string' },
          genre: { type: 'string' },
          dimension: { type: 'string', enum: ['2d', '3d'] },
          artStyle: { type: 'string' },
          additionalRequirements: { type: 'string' },
        },
        required: ['projectName'],
      },
    };

    const resp = await client.chat.completions.create({
      model: modelName,
      messages: [systemMessage, ...messages] as any,
      tools: [{ type: 'function', function: suggestProjectFunctionDef }],
      max_tokens: 800,
    });

    const choice = resp.choices?.[0];

    // Prefer structured function_call arguments
    const toolCall = choice?.message?.tool_calls?.[0] as any;
    // Some OpenAI client versions use different shapes for tool calls.
    // Try several possible places for the function/tool arguments.
    const toolCallArgs = toolCall?.function?.arguments ?? toolCall?.tool?.arguments ?? toolCall?.arguments;
    if (toolCallArgs) {
      const text = toolCallArgs as string;
      try {
        return JSON.parse(text);
      } catch (err) {
        // try extract first JSON object
        const s = text.trim();
        const first = s.indexOf('{');
        if (first !== -1) {
          let brace = 0;
          let end = -1;
          for (let i = first; i < s.length; i++) {
            if (s[i] === '{') brace++;
            else if (s[i] === '}') { brace--; if (brace === 0) { end = i; break; } }
          }
          if (end !== -1) {
            const sub = s.substring(first, end + 1);
            try { return JSON.parse(sub); } catch (e) { /* fallthrough */ }
          }
        }
        return { additionalRequirements: text };
      }
    }

    // Fallback to plain content
    const text = choice?.message?.content || '';
    try { return JSON.parse(text as string); } catch (err) {
      const s = (text as string).trim();
      const first = s.indexOf('{');
      if (first !== -1) {
        let brace = 0;
        let end = -1;
        for (let i = first; i < s.length; i++) {
          if (s[i] === '{') brace++;
          else if (s[i] === '}') { brace--; if (brace === 0) { end = i; break; } }
        }
        if (end !== -1) {
          const sub = s.substring(first, end + 1);
          try { return JSON.parse(sub); } catch (e) { /* fallthrough */ }
        }
      }
    }

    return { additionalRequirements: text };
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
        '你是一个游戏公司管理助手。\n\n' +
        '**重要规则**：\n' +
        '1. 创建公司时，maxEmployees 必须设置为 6（固定值）\n' +
        '2. 公司创建后，你必须引导用户提供6位必需员工的信息：\n' +
        '   - 策划（planner）: 负责游戏设计文档\n' +
        '   - 架构师（architect）: 负责技术架构设计\n' +
        '   - 美术（artist）: 负责游戏美术资源\n' +
        '   - 研发（developer）: 负责游戏代码开发\n' +
        '   - 测试（tester）: 负责游戏测试\n' +
        '   - 音频（music）: 负责游戏音频\n' +
        '3. 每个员工需要的信息：姓名、类型(type)、维度(dimension: 2d/3d)、专长(specialization)、AI模型(ai_model)\n' +
        '4. **关键**：每次只能调用一次 create_agent 函数创建一个员工，绝对不要返回多个 JSON 对象\n' +
        '5. 创建一个员工后，等待系统响应，然后继续引导创建下一个员工，直到6个员工全部创建完成\n' +
        '6. 如果用户一次性提供了多个员工信息，你应该从第一个开始逐个创建，不要试图一次性创建多个\n\n' +
        '你的任务是收集所有必需信息，然后调用相应的函数。如果信息不完整，请礼貌地询问用户。',
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
      '你是一个游戏公司管理助手。\n\n' +
      '**重要规则**：\n' +
      '1. 创建公司时，maxEmployees 必须设置为 6（固定值）\n' +
      '2. 公司创建后，你必须引导用户提供6位必需员工的信息：\n' +
      '   - 策划（planner）: 负责游戏设计文档\n' +
      '   - 架构师（architect）: 负责技术架构设计\n' +
      '   - 美术（artist）: 负责游戏美术资源\n' +
      '   - 研发（developer）: 负责游戏代码开发\n' +
      '   - 测试（tester）: 负责游戏测试\n' +
      '   - 音频（music）: 负责游戏音频\n' +
      '3. 每个员工需要的信息：姓名、类型(type)、维度(dimension: 2d/3d)、专长(specialization)、AI模型(ai_model)\n' +
      '4. **关键**：每次只能调用一次 create_agent 函数创建一个员工，绝对不要返回多个 JSON 对象\n' +
      '5. 创建一个员工后，等待系统响应，然后继续引导创建下一个员工，直到6个员工全部创建完成\n' +
      '6. 如果用户一次性提供了多个员工信息，你应该从第一个开始逐个创建，不要试图一次性创建多个\n\n' +
      '你的任务是收集所有必需信息，然后调用相应的函数。如果信息不完整，请礼貌地询问用户。';

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
