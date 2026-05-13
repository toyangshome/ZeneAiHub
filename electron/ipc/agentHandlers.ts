import { ipcMain, dialog } from 'electron';
import { IPC } from '@shared/types/ipc';
import { agentService } from '../services/agent/AgentService';
import type { AgentSessionConfig } from '@shared/types/agent';

export function registerAgentHandlers(): void {
  ipcMain.handle(IPC.AGENT_CHECK_CLI, async () => {
    return agentService.checkCli();
  });

  ipcMain.handle(IPC.AGENT_GET_CLI_VERSION, async () => {
    return agentService.getCliVersion();
  });

  ipcMain.handle(IPC.AGENT_SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目目录',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.AGENT_SESSION_CREATE, async (event, config: AgentSessionConfig) => {
    try {
      const sessionId = agentService.startSession(config, event.sender);
      return { sessionId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '创建 Agent 会话失败';
      throw new Error(msg);
    }
  });

  ipcMain.handle(IPC.AGENT_SESSION_SEND, async (_event, sessionId: string, content: string) => {
    const ok = agentService.sendMessage(sessionId, content);
    if (!ok) throw new Error('发送消息失败：会话不存在或已关闭');
  });

  ipcMain.handle(IPC.AGENT_SESSION_STOP, async (_event, sessionId: string) => {
    agentService.stopSession(sessionId);
  });
}
