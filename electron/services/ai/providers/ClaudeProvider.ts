import { BaseProvider } from './BaseProvider';
import type { Message, StreamConfig } from '@shared/types';

export class ClaudeProvider extends BaseProvider {
  formatMessages(messages: Message[], _systemPrompt?: string) {
    const formatted: Array<{ role: string; content: string }> = [];
    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        formatted.push({ role: msg.role, content: msg.content });
      }
    }
    return formatted;
  }

  async *streamChat(
    messages: Message[],
    config: StreamConfig,
    apiKey: string,
  ): AsyncGenerator<string, void, unknown> {
    const baseUrl = config.baseUrl || 'https://api.anthropic.com';
    const url = `${baseUrl}/v1/messages`;

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      messages: this.formatMessages(messages),
      stream: true,
    };

    if (config.systemPrompt) {
      body.system = config.systemPrompt;
    }

    // 扩展思考模式
    if (config.thinking) {
      body.thinking = { type: 'enabled', budget_tokens: Math.min(config.maxTokens - 1, 16000) };
      // thinking 模式下 temperature 必须为 1
      body.temperature = 1;
      delete body.top_p;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error ${response.status}: ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);

        try {
          const parsed = JSON.parse(data);

          // thinking 块
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'thinking_delta') {
            yield `[THINKING]${parsed.delta.thinking}[/THINKING]`;
          }
          // 正文块
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
          // 兼容旧格式
          if (parsed.type === 'content_block_delta' && parsed.delta?.text && !parsed.delta?.type) {
            yield parsed.delta.text;
          }
          if (parsed.type === 'message_stop') return;
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}
