import { v4 as uuidv4 } from 'uuid';
import type { Message, StreamConfig, StreamEvent, ToolCall } from '@shared/types';
import { getProvider } from './ProviderRegistry';
import { getSecureStore } from '../storage/SecureStore';
import { mcpManager } from '../mcp/MCPManager';
import { logger } from '../logger/Logger';

const activeStreams = new Map<string, AbortController>();

export async function startStream(
  requestId: string,
  messages: Message[],
  config: StreamConfig,
  sender: Electron.WebContents,
): Promise<void> {
  const secureStore = getSecureStore();
  const apiKey = secureStore.get(`apikey:${config.modelId}`);

  if (!apiKey) {
    sender.send(`ai:stream:error:${requestId}`, 'API Key 未配置');
    return;
  }

  const provider = getProvider(config.provider);
  const abortController = new AbortController();
  activeStreams.set(requestId, abortController);

  try {
    // 维护内部消息列表（工具循环中追加 assistant/tool 消息）
    const accumulatedMessages: Message[] = [...messages];
    const maxToolRounds = 5;

    for (let round = 0; round < maxToolRounds; round++) {
      if (abortController.signal.aborted) break;

      // 每轮重新格式化，确保 provider 正确处理 tool 结果
      const formattedMessages = provider.formatMessages(accumulatedMessages, config.systemPrompt);
      const stream = provider.streamChat(formattedMessages, config, apiKey);
      let assistantContent = '';
      const accumulatedToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
      let hasToolCalls = false;

      for await (const event of stream) {
        if (abortController.signal.aborted) break;

        if (event.type === 'text') {
          assistantContent += event.content;
          sender.send(`ai:stream:chunk:${requestId}`, event.content);
        } else if (event.type === 'tool_calls') {
          hasToolCalls = true;
          for (const tc of event.toolCalls) {
            // 合并同 ID 的 tool_call 片段（OpenAI 流式分片）
            const existing = accumulatedToolCalls.find((t) => t.id === tc.id);
            if (existing) {
              existing.arguments += tc.arguments;
              if (tc.name) existing.name = tc.name;
            } else {
              accumulatedToolCalls.push({ ...tc });
            }
          }
        }
      }

      // 没有工具调用 → 流结束
      if (!hasToolCalls || abortController.signal.aborted) break;

      // 通知 UI：工具调用开始
      sender.send(`ai:stream:tool-call:${requestId}`, accumulatedToolCalls);

      // 构建 assistant 消息（含 toolCalls）追加到内部消息列表
      const toolCallsForMsg: ToolCall[] = accumulatedToolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments,
      }));

      const assistantMsg: Message = {
        id: uuidv4(),
        conversationId: messages[0]?.conversationId || '',
        role: 'assistant',
        content: assistantContent,
        createdAt: Date.now(),
        toolCalls: toolCallsForMsg,
      };
      accumulatedMessages.push(assistantMsg);

      // 执行每个工具调用
      const toolResults: ToolCall[] = [];
      for (const tc of accumulatedToolCalls) {
        if (abortController.signal.aborted) break;

        const mcpTool = config.mcpTools?.find((t) => t.name === tc.name);
        if (!mcpTool) {
          logger.warn('AI', `工具 "${tc.name}" 未在 MCP 工具列表中找到`);
          toolResults.push({ id: tc.id, name: tc.name, arguments: tc.arguments, result: `工具 "${tc.name}" 未找到` });
          sender.send(`ai:stream:tool-result:${requestId}`, {
            id: tc.id, name: tc.name, result: `工具 "${tc.name}" 未找到`, isError: true,
          });
          continue;
        }

        try {
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.arguments); } catch { /* 空参数 */ }

          const result = await mcpManager.callTool(mcpTool.serverId, tc.name, args);
          const resultText = result.content.map((c) => c.text || `[${c.type}]`).join('\n');

          toolResults.push({ id: tc.id, name: tc.name, arguments: tc.arguments, result: resultText });

          sender.send(`ai:stream:tool-result:${requestId}`, {
            id: tc.id, name: tc.name, result: resultText, isError: result.isError,
          });

          logger.info('AI', `工具 ${tc.name} 执行成功`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          toolResults.push({ id: tc.id, name: tc.name, arguments: tc.arguments, result: errMsg });

          sender.send(`ai:stream:tool-result:${requestId}`, {
            id: tc.id, name: tc.name, result: errMsg, isError: true,
          });

          logger.error('AI', `工具 ${tc.name} 执行失败`, err);
        }
      }

      // 追加工具结果消息
      if (toolResults.length > 0) {
        const toolMsg: Message = {
          id: uuidv4(),
          conversationId: messages[0]?.conversationId || '',
          role: 'tool',
          content: '',
          createdAt: Date.now(),
          toolCalls: toolResults,
        };
        accumulatedMessages.push(toolMsg);
      }
    }

    if (!abortController.signal.aborted) {
      sender.send(`ai:stream:done:${requestId}`);
    }

    logger.info('AI', `Stream completed: ${requestId}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    sender.send(`ai:stream:error:${requestId}`, msg);
    logger.error('AI', `Stream failed: ${requestId}`, error);
  } finally {
    activeStreams.delete(requestId);
  }
}

export function cancelStream(requestId: string): void {
  const controller = activeStreams.get(requestId);
  if (controller) {
    controller.abort();
    activeStreams.delete(requestId);
    logger.info('AI', `Stream cancelled: ${requestId}`);
  }
}
