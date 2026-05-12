import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { PromptRepo } from '../services/storage/repositories/PromptRepo';
import type { PromptTemplate } from '@shared/types';
import { IPC } from '@shared/types/ipc';

export function registerPromptHandlers(): void {
  const repo = new PromptRepo();

  ipcMain.handle(IPC.PROMPT_LIST, async (_event, options?) => repo.list(options));
  ipcMain.handle(IPC.PROMPT_GET, async (_event, id: string) => repo.get(id));
  ipcMain.handle(IPC.PROMPT_SAVE, async (_event, data: Partial<PromptTemplate> & { id?: string }) => {
    if (!data.id) data.id = uuidv4();
    repo.save(data as Parameters<typeof repo.save>[0]);
  });
  ipcMain.handle(IPC.PROMPT_DELETE, async (_event, id: string) => repo.delete(id));
  ipcMain.handle(IPC.PROMPT_INCREMENT, async (_event, id: string) => repo.incrementUsage(id));
  ipcMain.handle(IPC.PROMPT_CATEGORIES, async () => repo.getCategories());
  ipcMain.handle(IPC.PROMPT_INTERPOLATE, async (_event, content: string, variables: Record<string, string>) => {
    return content.replace(/\{\{(\w+)\}\}/g, (_match, name) => variables[name] ?? _match);
  });
}
