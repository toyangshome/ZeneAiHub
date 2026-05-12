import { BaseProvider } from './BaseProvider';
import type { Message, StreamConfig } from '@shared/types';

export class OpenAIProvider extends BaseProvider {
  formatMessages(messages: Message[], systemPrompt?: string) {
    const formatted: Array<{ role: string; content: string }> = [];
    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }
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
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: config.model,
      messages: this.formatMessages(messages, config.systemPrompt),
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      stream: true,
    };

    // 扩展推理模式（OpenAI o1/o3 等推理模型）
    if (config.thinking) {
      body.reasoning = { effort: 'medium' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err}`);
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
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          // 推理内容（o1/o3 等推理模型）
          if (delta?.reasoning_content) {
            yield `[THINKING]${delta.reasoning_content}[/THINKING]`;
          }
          // 正文内容
          if (delta?.content) {
            yield delta.content;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}
