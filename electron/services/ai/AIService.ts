import { BrowserWindow } from 'electron';
import type { Message, StreamConfig } from '@shared/types';
import { getProvider } from './ProviderRegistry';
import { getSecureStore } from '../storage/SecureStore';
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
    const stream = provider.streamChat(messages, config, apiKey);

    for await (const chunk of stream) {
      if (abortController.signal.aborted) break;
      sender.send(`ai:stream:chunk:${requestId}`, chunk);
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
