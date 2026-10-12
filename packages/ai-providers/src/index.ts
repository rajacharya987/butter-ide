import {
  AIProviderId,
  AIProviderConfig,
  ChatMessage,
  ToolDefinition,
  ToolCall,
  StreamChunk,
  TokenUsage,
  ConnectionTestResult,
} from '@ai-ide/shared';

// ==========================================
// 1. Base Provider Interface
// ==========================================

export interface AIProvider {
  id: AIProviderId;
  displayName: string;
  testConnection(config: AIProviderConfig): Promise<ConnectionTestResult>;
  chat(params: {
    config: AIProviderConfig;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
  }): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: TokenUsage }>;
  streamChat(params: {
    config: AIProviderConfig;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    onChunk: (chunk: StreamChunk) => void;
  }): Promise<void>;
}

// ==========================================
// 2. OpenAI & OpenAI-Compatible Provider
// ==========================================

export class OpenAICompatibleProvider implements AIProvider {
  public id: AIProviderId;
  public displayName: string;

  constructor(id: AIProviderId = 'custom_openai', displayName = 'OpenAI Compatible') {
    this.id = id;
    this.displayName = displayName;
  }

  protected getBaseUrl(config: AIProviderConfig): string {
    let base = config.baseUrl || 'https://api.openai.com/v1';
    return base.replace(/\/+$/, '');
  }

  protected getHeaders(config: AIProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.customHeaders,
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }
    return headers;
  }

  public async testConnection(config: AIProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const url = `${this.getBaseUrl(config)}/chat/completions`;
      const res = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(config),
        body: JSON.stringify({
          model: config.defaultModel || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs || 10000),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const errText = await res.text();
        return {
          providerId: this.id,
          success: false,
          model: config.defaultModel,
          latencyMs,
          error: `HTTP ${res.status}: ${errText.slice(0, 300)}`,
        };
      }

      return {
        providerId: this.id,
        success: true,
        model: config.defaultModel,
        latencyMs,
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        success: false,
        model: config.defaultModel,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Connection failed',
      };
    }
  }

  public async chat(params: {
    config: AIProviderConfig;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
  }): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: TokenUsage }> {
    const { config, messages, tools, temperature } = params;
    const url = `${this.getBaseUrl(config)}/chat/completions`;

    const openAiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls?.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
      tool_call_id: m.toolCallId,
    }));

    const bodyPayload: any = {
      model: config.defaultModel,
      messages: openAiMessages,
      temperature: temperature ?? 0.2,
      max_tokens: config.maxTokens || 4096,
    };

    if (tools && tools.length > 0 && config.supportsToolCalling) {
      bodyPayload.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(config),
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(config.requestTimeoutMs || 60000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[${this.displayName}] HTTP ${res.status}: ${err}`);
    }

    const data: any = await res.json();
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = message?.content || '';

    let toolCalls: ToolCall[] | undefined = undefined;
    if (message?.tool_calls && message.tool_calls.length > 0) {
      toolCalls = message.tool_calls.map((tc: any) => {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = { raw: tc.function.arguments };
        }
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: args,
        };
      });
    }

    const usage: TokenUsage = {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    };

    return { content, toolCalls, usage };
  }

  public async streamChat(params: {
    config: AIProviderConfig;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    onChunk: (chunk: StreamChunk) => void;
  }): Promise<void> {
    const { config, messages, tools, temperature, onChunk } = params;
    const url = `${this.getBaseUrl(config)}/chat/completions`;

    const openAiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
      tool_calls: m.toolCalls?.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      })),
      tool_call_id: m.toolCallId,
    }));

    const bodyPayload: any = {
      model: config.defaultModel,
      messages: openAiMessages,
      temperature: temperature ?? 0.2,
      max_tokens: config.maxTokens || 4096,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (tools && tools.length > 0 && config.supportsToolCalling) {
      bodyPayload.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(config),
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(config.requestTimeoutMs || 120000),
    });

    if (!res.ok) {
      const err = await res.text();
      onChunk({ type: 'error', error: `HTTP ${res.status}: ${err}` });
      return;
    }

    if (!res.body) {
      onChunk({ type: 'error', error: 'Empty response stream' });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const toolCallAccumulator: Record<number, { id: string; name: string; argsJson: string }> = {};

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') {
            onChunk({ type: 'done' });
            continue;
          }
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                onChunk({ type: 'text', text: delta.content });
              }

              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCallAccumulator[idx]) {
                    toolCallAccumulator[idx] = {
                      id: tc.id || `call_${idx}`,
                      name: tc.function?.name || '',
                      argsJson: '',
                    };
                  }
                  if (tc.function?.name) {
                    toolCallAccumulator[idx].name = tc.function.name;
                  }
                  if (tc.function?.arguments) {
                    toolCallAccumulator[idx].argsJson += tc.function.arguments;
                  }
                }
              }

              if (parsed.usage) {
                onChunk({
                  type: 'usage',
                  tokenUsage: {
                    promptTokens: parsed.usage.prompt_tokens,
                    completionTokens: parsed.usage.completion_tokens,
                    totalTokens: parsed.usage.total_tokens,
                  },
                });
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        }
      }

      // Flush any accumulated tool calls
      for (const idx of Object.keys(toolCallAccumulator)) {
        const item = toolCallAccumulator[Number(idx)];
        let args = {};
        try {
          args = JSON.parse(item.argsJson);
        } catch {
          args = { raw: item.argsJson };
        }
        onChunk({
          type: 'tool_call',
          toolCall: {
            id: item.id,
            name: item.name,
            arguments: args,
          },
        });
      }

      onChunk({ type: 'done' });
    } catch (err: any) {
      onChunk({ type: 'error', error: err.message });
    }
  }
}

// ==========================================
// 3. Anthropic Claude Provider
// ==========================================

export class ClaudeProvider implements AIProvider {
  public readonly id: AIProviderId = 'claude';
  public readonly displayName = 'Anthropic Claude';

  public async testConnection(config: AIProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const url = 'https://api.anthropic.com/v1/messages';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.defaultModel || 'claude-3-5-sonnet-20241022',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Ping' }],
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs || 10000),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const err = await res.text();
        return {
          providerId: this.id,
          success: false,
          model: config.defaultModel,
          latencyMs,
          error: `HTTP ${res.status}: ${err.slice(0, 300)}`,
        };
      }

      return {
        providerId: this.id,
        success: true,
        model: config.defaultModel,
        latencyMs,
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        success: false,
        model: config.defaultModel,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Connection failed',
      };
    }
  }

  public async chat(params: {
    config: AIProviderConfig;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
  }): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: TokenUsage }> {
    const { config, messages, tools, temperature } = params;
    const url = 'https://api.anthropic.com/v1/messages';

    let systemPrompt = '';
    const formattedMessages: any[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + m.content;
      } else if (m.role === 'tool') {
        formattedMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: m.content,
            },
          ],
        });
      } else {
        formattedMessages.push({
          role: m.role,
          content: m.content,
        });
      }
    }

    const payload: any = {
      model: config.defaultModel || 'claude-3-5-sonnet-20241022',
      max_tokens: config.maxTokens || 4096,
      messages: formattedMessages,
      temperature: temperature ?? 0.2,
    };

    if (systemPrompt) payload.system = systemPrompt;
    if (tools && tools.length > 0 && config.supportsToolCalling) {
      payload.tools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.requestTimeoutMs || 60000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Claude] HTTP ${res.status}: ${err}`);
    }

    const data: any = await res.json();
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const block of data.content || []) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input || {},
        });
      }
    }

    const usage: TokenUsage = {
      promptTokens: data.usage?.input_tokens || 0,
      completionTokens: data.usage?.output_tokens || 0,
      totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
    };
  }

  public async streamChat(params: {
    config: AIProviderConfig;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    onChunk: (chunk: StreamChunk) => void;
  }): Promise<void> {
    const { onChunk } = params;
    // Fall back to chat and stream output smoothly if direct SSE is not supported by endpoint
    try {
      const result = await this.chat(params);
      if (result.content) {
        onChunk({ type: 'text', text: result.content });
      }
      if (result.toolCalls) {
        for (const tc of result.toolCalls) {
          onChunk({ type: 'tool_call', toolCall: tc });
        }
      }
      if (result.usage) {
        onChunk({ type: 'usage', tokenUsage: result.usage });
      }
      onChunk({ type: 'done' });
    } catch (err: any) {
      onChunk({ type: 'error', error: err.message });
    }
  }
}

// ==========================================
// 4. Google Gemini Provider
// ==========================================

export class GeminiProvider implements AIProvider {
  public readonly id: AIProviderId = 'gemini';
  public readonly displayName = 'Google Gemini';

  public async testConnection(config: AIProviderConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      const model = config.defaultModel || 'gemini-2.0-flash';
      const key = config.apiKey || '';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Ping' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
        signal: AbortSignal.timeout(config.requestTimeoutMs || 10000),
      });

      const latencyMs = Date.now() - startTime;
      if (!res.ok) {
        const err = await res.text();
        return {
          providerId: this.id,
          success: false,
          model,
          latencyMs,
          error: `HTTP ${res.status}: ${err.slice(0, 300)}`,
        };
      }

      return {
        providerId: this.id,
        success: true,
        model,
        latencyMs,
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        success: false,
        model: config.defaultModel,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Connection failed',
      };
    }
  }

  public async chat(params: {
    config: AIProviderConfig;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
  }): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: TokenUsage }> {
    const { config, messages, tools, temperature } = params;
    const model = config.defaultModel || 'gemini-2.0-flash';
    const key = config.apiKey || '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const payload: any = {
      contents,
      generationConfig: {
        temperature: temperature ?? 0.2,
        maxOutputTokens: config.maxTokens || 4096,
      },
    };

    if (tools && tools.length > 0 && config.supportsToolCalling) {
      payload.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.requestTimeoutMs || 60000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Gemini] HTTP ${res.status}: ${err}`);
    }

    const data: any = await res.json();
    const candidate = data.candidates?.[0];
    let content = '';
    const toolCalls: ToolCall[] = [];

    for (const part of candidate?.content?.parts || []) {
      if (part.text) {
        content += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `gemini_call_${Date.now()}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }

    const usage: TokenUsage = {
      promptTokens: data.usageMetadata?.promptTokenCount || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: data.usageMetadata?.totalTokenCount || 0,
    };

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
    };
  }

  public async streamChat(params: {
    config: AIProviderConfig;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
    onChunk: (chunk: StreamChunk) => void;
  }): Promise<void> {
    const { onChunk } = params;
    try {
      const result = await this.chat(params);
      if (result.content) onChunk({ type: 'text', text: result.content });
      if (result.toolCalls) {
        for (const tc of result.toolCalls) onChunk({ type: 'tool_call', toolCall: tc });
      }
      if (result.usage) onChunk({ type: 'usage', tokenUsage: result.usage });
      onChunk({ type: 'done' });
    } catch (err: any) {
      onChunk({ type: 'error', error: err.message });
    }
  }
}

// ==========================================
// 5. Provider Registry & Vault
// ==========================================

export class AIProviderRegistry {
  private providers: Map<AIProviderId, AIProvider> = new Map();
  private configs: Map<AIProviderId, AIProviderConfig> = new Map();
  private activeProviderId: AIProviderId = 'custom_openai';
  private fallbackProviderId: AIProviderId | null = null;
  private privacyModeEnabled: boolean = false;

  constructor() {
    this.registerProvider(new OpenAICompatibleProvider('openai', 'OpenAI'));
    this.registerProvider(new ClaudeProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new OpenAICompatibleProvider('grok', 'xAI Grok'));
    this.registerProvider(new OpenAICompatibleProvider('custom_openai', 'Local / Custom Endpoint'));

    this.initDefaultConfigs();
  }

  private initDefaultConfigs() {
    this.configs.set('openai', {
      id: 'openai',
      displayName: 'OpenAI',
      enabled: false,
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o',
      availableModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3-mini'],
      supportsStreaming: true,
      supportsToolCalling: true,
    });

    this.configs.set('claude', {
      id: 'claude',
      displayName: 'Anthropic Claude',
      enabled: false,
      baseUrl: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-3-5-sonnet-20241022',
      availableModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
      supportsStreaming: true,
      supportsToolCalling: true,
    });

    this.configs.set('gemini', {
      id: 'gemini',
      displayName: 'Google Gemini',
      enabled: false,
      baseUrl: 'https://generativelanguage.googleapis.com',
      defaultModel: 'gemini-2.0-flash',
      availableModels: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      supportsStreaming: true,
      supportsToolCalling: true,
    });

    this.configs.set('grok', {
      id: 'grok',
      displayName: 'xAI Grok',
      enabled: false,
      baseUrl: 'https://api.x.ai/v1',
      defaultModel: 'grok-2-latest',
      availableModels: ['grok-2-latest', 'grok-beta'],
      supportsStreaming: true,
      supportsToolCalling: true,
    });

    this.configs.set('custom_openai', {
      id: 'custom_openai',
      displayName: 'Local / Custom Endpoint (Ollama, LM Studio, etc.)',
      enabled: true,
      baseUrl: 'http://localhost:11434/v1',
      defaultModel: 'llama3.2',
      availableModels: ['llama3.2', 'qwen2.5-coder', 'deepseek-r1', 'codellama', 'custom-model'],
      isLocal: true,
      supportsStreaming: true,
      supportsToolCalling: true,
    });
  }

  public registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: AIProviderId): AIProvider {
    const p = this.providers.get(id);
    if (!p) throw new Error(`AI Provider '${id}' not registered`);
    return p;
  }

  public getAllConfigs(): AIProviderConfig[] {
    return Array.from(this.configs.values());
  }

  public getConfig(id: AIProviderId): AIProviderConfig {
    const cfg = this.configs.get(id);
    if (!cfg) throw new Error(`Config for provider '${id}' not found`);
    return cfg;
  }

  public saveConfig(config: AIProviderConfig): void {
    this.configs.set(config.id, config);
  }

  public setPrivacyMode(enabled: boolean): void {
    this.privacyModeEnabled = enabled;
  }

  public isPrivacyModeEnabled(): boolean {
    return this.privacyModeEnabled;
  }

  public setActiveProvider(id: AIProviderId): void {
    if (this.providers.has(id)) {
      this.activeProviderId = id;
    }
  }

  public getActiveProviderId(): AIProviderId {
    return this.activeProviderId;
  }

  public setFallbackProvider(id: AIProviderId | null): void {
    this.fallbackProviderId = id;
  }

  public async testConnection(id: AIProviderId): Promise<ConnectionTestResult> {
    const provider = this.getProvider(id);
    const config = this.getConfig(id);
    return provider.testConnection(config);
  }

  public async chat(params: {
    providerId?: AIProviderId;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
  }): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: TokenUsage }> {
    if (this.privacyModeEnabled) {
      throw new Error('Privacy Mode Enabled: External AI network calls are disabled.');
    }

    const providerId = params.providerId || this.activeProviderId;
    const provider = this.getProvider(providerId);
    const config = this.getConfig(providerId);

    try {
      return await provider.chat({
        config,
        messages: params.messages,
        tools: params.tools,
        temperature: params.temperature,
      });
    } catch (err: any) {
      if (this.fallbackProviderId && this.fallbackProviderId !== providerId) {
        const fallback = this.getProvider(this.fallbackProviderId);
        const fallbackConfig = this.getConfig(this.fallbackProviderId);
        return await fallback.chat({
          config: fallbackConfig,
          messages: params.messages,
          tools: params.tools,
          temperature: params.temperature,
        });
      }
      throw err;
    }
  }
}
