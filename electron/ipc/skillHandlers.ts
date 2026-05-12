import { ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { SkillRepo } from '../services/storage/repositories/SkillRepo';
import type { Skill } from '@shared/types';
import { IPC } from '@shared/types/ipc';

export function registerSkillHandlers(): void {
  const repo = new SkillRepo();

  // 种子内置 Skill
  repo.seedBuiltInSkills();

  ipcMain.handle(IPC.SKILL_LIST, async (_event, options?) => repo.list(options));
  ipcMain.handle(IPC.SKILL_GET, async (_event, id: string) => repo.get(id));
  ipcMain.handle(IPC.SKILL_SAVE, async (_event, data: Partial<Skill> & { id?: string }) => {
    if (!data.id) data.id = uuidv4();
    repo.save(data as Parameters<typeof repo.save>[0]);
  });
  ipcMain.handle(IPC.SKILL_DELETE, async (_event, id: string) => repo.delete(id));
}
