import { ipcMain, shell, app, BrowserWindow } from 'electron';
import { getConfig, setConfig } from '../services/storage/ConfigStore';
import { IPC } from '@shared/types/ipc';

export function registerStoreHandlers(): void {
  // 存储
  ipcMain.handle(IPC.STORE_GET, async (_event, key: string, defaultValue?: unknown) => {
    return getConfig(key as never) ?? defaultValue;
  });

  ipcMain.handle(IPC.STORE_SET, async (_event, key: string, value: unknown) => {
    setConfig(key as never, value as never);
  });

  // 系统
  ipcMain.handle(IPC.SYSTEM_OPEN_EXTERNAL, async (_event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle(IPC.SYSTEM_GET_INFO, async () => ({
    platform: process.platform,
    version: app.getVersion(),
    electronVersion: process.versions.electron,
  }));

  ipcMain.handle(IPC.SYSTEM_GET_PATH, async (_event, name: string) => {
    return app.getPath(name as 'home' | 'appData' | 'userData' | 'temp' | 'desktop');
  });

  // 窗口控制
  ipcMain.handle(IPC.WINDOW_MINIMIZE, async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });

  ipcMain.handle(IPC.WINDOW_MAXIMIZE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  ipcMain.handle(IPC.WINDOW_CLOSE, async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });

  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, async (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
  });
}
