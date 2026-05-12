import { MCPClient, type MCPConnectionStatus } from './MCPClient';
import type { MCPServerConfig, MCPTool, MCPToolResult } from '@shared/types';
import { logger } from '../logger/Logger';

class MCPManager {
  private clients = new Map<string, MCPClient>();

  async connect(config: MCPServerConfig): Promise<MCPTool[]> {
    // 如果已有连接，先断开
    await this.disconnect(config.id);

    const client = new MCPClient(config);
    this.clients.set(config.id, client);

    try {
      const tools = await client.connect();
      logger.info('MCPManager', `Server "${config.name}" 已连接，发现 ${tools.length} 个工具`);
      return tools;
    } catch (err) {
      this.clients.delete(config.id);
      logger.error('MCPManager', `连接 Server "${config.name}" 失败`, err);
      throw err;
    }
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);
      logger.info('MCPManager', `Server ${serverId} 已断开`);
    }
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.clients.keys()).map((id) => this.disconnect(id));
    await Promise.allSettled(promises);
    this.clients.clear();
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const client = this.clients.get(serverId);
    if (!client) throw new Error(`Server ${serverId} 未连接`);
    return client.callTool(toolName, args);
  }

  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const [serverId, client] of this.clients) {
      tools.push(...client.getTools().map((t) => ({ ...t, serverId })));
    }
    return tools;
  }

  getServerTools(serverId: string): MCPTool[] {
    const client = this.clients.get(serverId);
    return client ? client.getTools() : [];
  }

  getStatus(serverId: string): MCPConnectionStatus {
    const client = this.clients.get(serverId);
    return client ? client.getStatus() : 'disconnected';
  }

  getAllStatuses(): Record<string, MCPConnectionStatus> {
    const statuses: Record<string, MCPConnectionStatus> = {};
    for (const [id, client] of this.clients) {
      statuses[id] = client.getStatus();
    }
    return statuses;
  }
}

export const mcpManager = new MCPManager();
