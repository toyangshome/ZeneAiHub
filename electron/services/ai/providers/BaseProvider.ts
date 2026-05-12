import type { Message, StreamConfig, StreamEvent } from '@shared/types';

export interface ProviderResponse {
  content: string;
  tokenCount?: number;
}

/** API 格式的消息（支持 tool 角色和结构化 content） */
export type FormattedMessage = {
  role: string;
  content: string | Array<{ type: string; text?: string; tool_use_id?: string; content?: string }>;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
};

export abstract class BaseProvider {
  abstract streamChat(
    messages: FormattedMessage[],
    config: StreamConfig,
    apiKey: string,
  ): AsyncGenerator<StreamEvent, void, unknown>;

  /** 将内部 Message 格式转为 API 格式（各 Provider 不同） */
  abstract formatMessages(messages: Message[], systemPrompt?: string): FormattedMessage[];
}
