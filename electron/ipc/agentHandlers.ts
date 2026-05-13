import { ipcMain, dialog } from 'electron';
import { IPC } from '@shared/types/ipc';

export function registerAgentHandlers(): void {
  ipcMain.handle(IPC.AGENT_SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目目录',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // TODO: 注册新的 Agent IPC handler
}
