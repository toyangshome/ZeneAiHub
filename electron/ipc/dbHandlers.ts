import { ipcMain } from 'electron';
import { ConversationRepo } from '../services/storage/repositories/ConversationRepo';
import { MessageRepo } from '../services/storage/repositories/MessageRepo';
import type { Conversation, Message } from '@shared/types';
import { IPC } from '@shared/types/ipc';

export function registerDBHandlers(): void {
  const convRepo = new ConversationRepo();
  const msgRepo = new MessageRepo();

  ipcMain.handle(IPC.DB_CONVERSATION_LIST, async (_event, options?) => convRepo.list(options));
  ipcMain.handle(IPC.DB_CONVERSATION_GET, async (_event, id: string) => convRepo.get(id));
  ipcMain.handle(IPC.DB_CONVERSATION_SAVE, async (_event, conv: Conversation) => convRepo.save(conv));
  ipcMain.handle(IPC.DB_CONVERSATION_DELETE, async (_event, id: string) => convRepo.delete(id));
  ipcMain.handle(IPC.DB_CONVERSATION_UPDATE_TITLE, async (_event, id: string, title: string) => convRepo.updateTitle(id, title));

  ipcMain.handle(IPC.DB_MESSAGE_LIST, async (_event, conversationId: string) => msgRepo.list(conversationId));
  ipcMain.handle(IPC.DB_MESSAGE_SAVE, async (_event, conversationId: string, message: Message) => msgRepo.save(conversationId, message));
}
