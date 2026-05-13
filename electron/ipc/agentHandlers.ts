import { ipcMain, dialog } from 'electron';
import { IPC } from '@shared/types/ipc';
import { agentService } from '../services/agent/AgentService';
import { checkClaudeCli, getCliVersion } from '../services/agent/CliChecker';
import type { AgentSessionConfig } from '@shared/types/agent';

export function registerAgentHandlers(): void {
  ipcMain.handle(IPC.AGENT_CHECK_CLI, async () => {
    return checkClaudeCli();
  });

  ipcMain.handle(IPC.AGENT_GET_CLI_VERSION, async () => {
    return getCliVersion();
  });

  ipcMain.handle(IPC.AGENT_SELECT_DIRECTORY, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目目录',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.AGENT_SESSION_START, async (event, config: AgentSessionConfig) => {
    try {
      const sessionId = agentService.startSession(config, event.sender);
      return { sessionId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : '启动 Agent 会话失败';
      throw new Error(msg);
    }
  });

  ipcMain.handle(IPC.AGENT_SESSION_CANCEL, async (_event, sessionId: string) => {
    agentService.cancelCurrentTurn(sessionId);
  });

  ipcMain.handle(IPC.AGENT_SESSION_STOP, async (_event, sessionId: string) => {
    agentService.stopSession(sessionId);
  });
}
