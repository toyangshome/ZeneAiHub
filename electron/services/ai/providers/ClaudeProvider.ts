import { BaseProvider, type FormattedMessage } from './BaseProvider';
import type { Message, StreamConfig, StreamEvent } from '@shared/types';

export class ClaudeProvider extends BaseProvider {
  formatMessages(messages: Message[], _systemPrompt?: string): FormattedMessage[] {
    const formatted: FormattedMessage[] = [];
    for (const msg of messages) {
      if (msg.role === 'tool' && msg.toolCalls && msg.toolCalls.length > 0) {
        // tool 结果消息 → Claude 格式的 tool_result content block
        formatted.push({
          role: 'user',
          content: msg.toolCalls.map((tc) => ({
            type: 'tool_result',
            tool_use_id: tc.id,
            content: tc.result || '',
          })),
        });
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        // 包含 tool_use 的 assistant 消息
        const blocks: Array<{ type: string; id?: string; name?: string; input?: unknown; text?: string }> = [];
        if (msg.content) {
          blocks.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          let input: unknown = {};
          try { input = JSON.parse(tc.arguments); } catch { /* ignore */ }
          blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
        }
        formatted.push({ role: 'assistant', content: blocks });
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        formatted.push({ role: msg.role, content: msg.content });
      }
    }
    return formatted;
  }

  /** 将 MCP 工具转为 Claude tool 格式 */
  private formatTools(mcpTools: StreamConfig['mcpTools']): unknown[] | undefined {
    if (!mcpTools || mcpTools.length === 0) return undefined;
    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  }

  formatToolResult(toolCallId: string, resultText: string, isError: boolean): FormattedMessage {
    return {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolCallId, content: resultText, is_error: isError }],
    };
  }

  async *streamChat(
    messages: FormattedMessage[],
    config: StreamConfig,
    apiKey: string,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const baseUrl = config.baseUrl || 'https://api.anthropic.com';
    const url = `${baseUrl}/v1/messages`;

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      top_p: config.topP,
      messages,
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

    // MCP 工具注入
    const tools = this.formatTools(config.mcpTools);
    if (tools) {
      body.tools = tools;
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

    // 收集 tool_use 块（流式传输时 input_json_delta 分多次到达）
    const pendingToolCalls = new Map<string, { id: string; name: string; jsonBuffer: string }>();

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
            yield { type: 'text', content: `[THINKING]${parsed.delta.thinking}[/THINKING]` };
          }

          // 正文块
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta?.text) {
            yield { type: 'text', content: parsed.delta.text };
          }

          // 兼容旧格式
          if (parsed.type === 'content_block_delta' && parsed.delta?.text && !parsed.delta?.type) {
            yield { type: 'text', content: parsed.delta.text };
          }

          // tool_use 开始
          if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
            const block = parsed.content_block;
            pendingToolCalls.set(String(parsed.index), {
              id: block.id,
              name: block.name,
              jsonBuffer: '',
            });
          }

          // tool_use input 片段
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
            const tool = pendingToolCalls.get(String(parsed.index));
            if (tool) {
              tool.jsonBuffer += parsed.delta.partial_json || '';
            }
          }

          // tool_use 结束 → 发出完整 tool_calls
          if (parsed.type === 'content_block_stop') {
            const tool = pendingToolCalls.get(String(parsed.index));
            if (tool) {
              yield {
                type: 'tool_calls',
                toolCalls: [{ id: tool.id, name: tool.name, arguments: tool.jsonBuffer }],
              };
              pendingToolCalls.delete(String(parsed.index));
            }
          }

          if (parsed.type === 'message_stop') return;
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}
