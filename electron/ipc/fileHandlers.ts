import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import type { FileFilter } from '@shared/types';
import { FileProcessor } from '../services/file/FileProcessor';
import { IPC } from '@shared/types/ipc';

export function registerFileHandlers(): void {
  const processor = new FileProcessor();

  ipcMain.handle(IPC.FILE_SELECT_DIALOG, async (event, filters?: FileFilter[]) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(win!, {
        properties: ['openFile', 'multiSelections'],
        filters: filters as Electron.FileFilter[] | undefined,
      });
      return result.canceled ? null : result.filePaths;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`文件选择失败: ${message}`);
    }
  });

  ipcMain.handle(IPC.FILE_EXPORT, async (event, data: string, defaultName: string, format: string) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      const filters: Electron.FileFilter[] = [];
      if (format === 'md') filters.push({ name: 'Markdown', extensions: ['md'] });
      else if (format === 'json') filters.push({ name: 'JSON', extensions: ['json'] });
      else filters.push({ name: 'Text', extensions: ['txt'] });

      const result = await dialog.showSaveDialog(win!, { defaultPath: defaultName, filters });
      if (result.canceled || !result.filePath) return null;
      fs.writeFileSync(result.filePath, data, 'utf-8');
      return result.filePath;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`文件导出失败: ${message}`);
    }
  });

  ipcMain.handle(IPC.FILE_READ, async (_event, filePath: string) => {
    try {
      return await processor.processFile(filePath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`文件读取失败: ${message}`);
    }
  });

  ipcMain.handle(IPC.FILE_INFO, async (_event, filePath: string) => {
    try {
      return processor.getFileInfo(filePath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`获取文件信息失败: ${message}`);
    }
  });
}
