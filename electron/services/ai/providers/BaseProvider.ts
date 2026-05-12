import type { Message, StreamConfig } from '@shared/types';

export interface ProviderResponse {
  content: string;
  tokenCount?: number;
}

export abstract class BaseProvider {
  abstract streamChat(
    messages: Message[],
    config: StreamConfig,
    apiKey: string,
  ): AsyncGenerator<string, void, unknown>;

  /** 将内部 Message 格式转为 API 格式（各 Provider 不同） */
  abstract formatMessages(messages: Message[], systemPrompt?: string): unknown[];
}
