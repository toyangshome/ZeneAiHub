import { BaseProvider, type FormattedMessage } from './BaseProvider';
import type { Message, StreamConfig, StreamEvent } from '@shared/types';

export class OpenAIProvider extends BaseProvider {
  formatMessages(messages: Message[], systemPrompt?: string): FormattedMessage[] {
    const formatted: FormattedMessage[] = [];
    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of messages) {
      if (msg.role === 'tool') {
        formatted.push({
          role: 'tool',
          content: msg.content,
        });
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        formatted.push({
          role: 'assistant',
          content: msg.content || '',
          tool_calls: msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        formatted.push({ role: msg.role, content: msg.content });
      }
    }
    return formatted;
  }

  /** 将 MCP 工具转为 OpenAI function calling 格式 */
  private formatTools(mcpTools: StreamConfig['mcpTools']): unknown[] | undefined {
    if (!mcpTools || mcpTools.length === 0) return undefined;
    return mcpTools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  async *streamChat(
    messages: FormattedMessage[],
    config: StreamConfig,
    apiKey: string,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    const url = `${baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      stream: true,
    };

    // 扩展推理模式（OpenAI o1/o3 等推理模型）
    if (config.thinking) {
      body.reasoning = { effort: 'medium' };
    }

    // MCP 工具注入
    const tools = this.formatTools(config.mcpTools);
    if (tools) {
      body.tools = tools;
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
          if (!delta) continue;

          // 推理内容（o1/o3 等推理模型）
          if (delta.reasoning_content) {
            yield { type: 'text', content: `[THINKING]${delta.reasoning_content}[/THINKING]` };
          }

          // 正文内容
          if (delta.content) {
            yield { type: 'text', content: delta.content };
          }

          // 工具调用
          if (delta.tool_calls) {
            yield {
              type: 'tool_calls',
              toolCalls: delta.tool_calls.map((tc: { id?: string; index: number; function?: { name?: string; arguments?: string } }) => ({
                id: tc.id || `call_${tc.index}`,
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              })),
            };
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}
