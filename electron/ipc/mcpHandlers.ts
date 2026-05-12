import { ipcMain } from 'electron';
import { IPC } from '@shared/types/ipc';
import { MCPServerRepo } from '../services/storage/repositories/MCPServerRepo';
import { mcpManager } from '../services/mcp/MCPManager';
import { localFileTools, handleLocalToolCall } from '../services/mcp/LocalFileTools';
import type { MCPServerConfig } from '@shared/types';

export function registerMCPHandlers(): void {
  const repo = new MCPServerRepo();

  ipcMain.handle(IPC.MCP_SERVER_LIST, async () => {
    const servers = repo.list();
    const statuses = mcpManager.getAllStatuses();
    return servers.map((s) => ({
      ...s,
      status: statuses[s.id] || 'disconnected',
    }));
  });

  ipcMain.handle(IPC.MCP_SERVER_SAVE, async (_event, config: MCPServerConfig) => {
    repo.save(config);
  });

  ipcMain.handle(IPC.MCP_SERVER_DELETE, async (_event, id: string) => {
    await mcpManager.disconnect(id);
    repo.delete(id);
  });

  ipcMain.handle(IPC.MCP_SERVER_CONNECT, async (_event, id: string) => {
    const config = repo.get(id);
    if (!config) throw new Error(`Server ${id} 不存在`);

    // 本地工具：直接注册，不走 MCP 协议
    if (config.local || config.transport === 'local') {
      mcpManager.registerLocalTools(config.id, config.name, localFileTools, handleLocalToolCall);
      const tools = mcpManager.getServerTools(config.id);
      return { success: true, tools, status: 'connected' };
    }

    const tools = await mcpManager.connect(config);
    return { success: true, tools, status: 'connected' };
  });

  ipcMain.handle(IPC.MCP_SERVER_DISCONNECT, async (_event, id: string) => {
    await mcpManager.disconnect(id);
    return { success: true, status: 'disconnected' };
  });

  ipcMain.handle(IPC.MCP_TOOL_LIST, async (_event, serverId?: string) => {
    if (serverId) return mcpManager.getServerTools(serverId);
    return mcpManager.getAllTools();
  });

  ipcMain.handle(IPC.MCP_TOOL_CALL, async (_event, serverId: string, toolName: string, args: Record<string, unknown>) => {
    return mcpManager.callTool(serverId, toolName, args);
  });

  ipcMain.handle(IPC.MCP_STATUS, async () => {
    return mcpManager.getAllStatuses();
  });
}
