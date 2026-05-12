import { MCPClient, type MCPConnectionStatus } from './MCPClient';
import type { MCPServerConfig, MCPTool, MCPToolResult } from '@shared/types';
import { logger } from '../logger/Logger';

type LocalToolHandler = (toolName: string, args: Record<string, unknown>) => Promise<MCPToolResult>;

interface LocalServerEntry {
  name: string;
  tools: Omit<MCPTool, 'serverId'>[];
  handler: LocalToolHandler;
}

class MCPManager {
  private clients = new Map<string, MCPClient>();
  private localServers = new Map<string, LocalServerEntry>();

  async connect(config: MCPServerConfig): Promise<MCPTool[]> {
    // 本地工具：直接注册，不走 MCP 协议
    if (config.local || config.transport === 'local') {
      logger.info('MCPManager', `注册本地工具 Server: "${config.name}"`);
      // localServers 应已在 registerLocalTools 中注册
      return this.getServerTools(config.id);
    }

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
    // 本地工具：直接移除
    if (this.localServers.has(serverId)) {
      this.localServers.delete(serverId);
      logger.info('MCPManager', `本地工具 Server ${serverId} 已移除`);
      return;
    }

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
    this.localServers.clear();
  }

  /** 注册本地工具 Server */
  registerLocalTools(serverId: string, name: string, tools: Omit<MCPTool, 'serverId'>[], handler: LocalToolHandler): void {
    this.localServers.set(serverId, { name, tools, handler });
    logger.info('MCPManager', `本地工具 Server "${name}" 已注册，${tools.length} 个工具`);
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    // 本地工具优先
    const local = this.localServers.get(serverId);
    if (local) {
      return local.handler(toolName, args);
    }

    const client = this.clients.get(serverId);
    if (!client) throw new Error(`Server ${serverId} 未连接`);
    return client.callTool(toolName, args);
  }

  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    // 本地工具
    for (const [serverId, local] of this.localServers) {
      tools.push(...local.tools.map((t) => ({ ...t, serverId })));
    }

    // 外部 MCP 工具
    for (const [serverId, client] of this.clients) {
      tools.push(...client.getTools().map((t) => ({ ...t, serverId })));
    }

    return tools;
  }

  getServerTools(serverId: string): MCPTool[] {
    const local = this.localServers.get(serverId);
    if (local) {
      return local.tools.map((t) => ({ ...t, serverId }));
    }
    const client = this.clients.get(serverId);
    return client ? client.getTools() : [];
  }

  getStatus(serverId: string): MCPConnectionStatus {
    if (this.localServers.has(serverId)) return 'connected';
    const client = this.clients.get(serverId);
    return client ? client.getStatus() : 'disconnected';
  }

  getAllStatuses(): Record<string, MCPConnectionStatus> {
    const statuses: Record<string, MCPConnectionStatus> = {};
    for (const [id] of this.localServers) {
      statuses[id] = 'connected';
    }
    for (const [id, client] of this.clients) {
      statuses[id] = client.getStatus();
    }
    return statuses;
  }
}

export const mcpManager = new MCPManager();
