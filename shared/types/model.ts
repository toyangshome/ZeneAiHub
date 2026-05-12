/** Provider 类型 */
export type ProviderType = 'openai' | 'anthropic' | 'google' | 'ollama' | 'lmstudio' | 'custom';

/** 渲染进程看到的脱敏模型配置 */
export interface ModelConfigPublic {
  id: string;
  name: string;
  provider: ProviderType;
  hasApiKey: boolean;
  apiKeyMasked?: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  thinking: boolean;
  enabled: boolean;
  order: number;
}

/** 主进程完整模型配置 */
export interface ModelConfig extends ModelConfigPublic {
  apiKeyRef: string;
}

/** 渲染进程提交的模型配置输入 */
export interface ModelConfigInput {
  id?: string;
  name: string;
  provider: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  thinking?: boolean;
}

/** 流式对话配置 */
export interface StreamConfig {
  modelId: string;
  provider: ProviderType;
  model: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  systemPrompt?: string;
  thinking?: boolean;
  mcpTools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    serverId: string;
  }>;
}

/** Provider 流式事件 */
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; toolCalls: Array<{ id: string; name: string; arguments: string }> };

/** 模型测试结果 */
export interface ModelTestResult {
  success: boolean;
  latency: number;
  error?: string;
}
