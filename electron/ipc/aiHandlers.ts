import { ipcMain } from 'electron';
import { startStream, cancelStream } from '../services/ai/AIService';
import type { Message, StreamConfig } from '@shared/types';
import { IPC } from '@shared/types/ipc';

export function registerAIHandlers(): void {
  ipcMain.handle(IPC.AI_STREAM_START, async (event, requestId: string, messages: Message[], config: StreamConfig) => {
    await startStream(requestId, messages, config, event.sender);
  });

  ipcMain.handle(IPC.AI_STREAM_CANCEL, async (_event, requestId: string) => {
    cancelStream(requestId);
  });
}
