import { create } from 'zustand';
import type { MCPServerConfig, MCPTool, MCPToolResult } from '@shared/types';
import { api } from '../services/ipcBridge';

interface MCPServerWithStatus extends MCPServerConfig {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

interface MCPState {
  servers: MCPServerWithStatus[];
  tools: MCPTool[];
  loading: boolean;

  loadServers: () => Promise<void>;
  saveServer: (config: MCPServerConfig) => Promise<void>;
  deleteServer: (id: string) => Promise<void>;
  connectServer: (id: string) => Promise<void>;
  disconnectServer: (id: string) => Promise<void>;
  loadTools: () => Promise<void>;
  callTool: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<MCPToolResult>;
}

export const useMCPStore = create<MCPState>((set, get) => ({
  servers: [],
  tools: [],
  loading: false,

  loadServers: async () => {
    set({ loading: true });
    try {
      const raw = await api.mcp.server.list();
      const servers = raw.map((s) => ({
        ...s,
        status: s.status as MCPServerWithStatus['status'],
      }));
      set({ servers, loading: false });
    } catch (err) {
      console.error('加载 MCP Server 列表失败:', err);
      set({ loading: false });
    }
  },

  saveServer: async (config) => {
    try {
      await api.mcp.server.save(config);
      await get().loadServers();
    } catch (err) {
      console.error('保存 MCP Server 失败:', err);
      throw err;
    }
  },

  deleteServer: async (id) => {
    try {
      await api.mcp.server.delete(id);
      await get().loadServers();
      await get().loadTools();
    } catch (err) {
      console.error('删除 MCP Server 失败:', err);
      throw err;
    }
  },

  connectServer: async (id) => {
    // 更新状态为 connecting
    set((s) => ({
      servers: s.servers.map((sv) => sv.id === id ? { ...sv, status: 'connecting' as const } : sv),
    }));
    try {
      const result = await api.mcp.server.connect(id);
      set((s) => ({
        servers: s.servers.map((sv) => sv.id === id ? { ...sv, status: 'connected' as const } : sv),
      }));
      await get().loadTools();
    } catch (err) {
      set((s) => ({
        servers: s.servers.map((sv) => sv.id === id ? { ...sv, status: 'error' as const } : sv),
      }));
      console.error('连接 MCP Server 失败:', err);
      throw err;
    }
  },

  disconnectServer: async (id) => {
    try {
      await api.mcp.server.disconnect(id);
      set((s) => ({
        servers: s.servers.map((sv) => sv.id === id ? { ...sv, status: 'disconnected' as const } : sv),
      }));
      await get().loadTools();
    } catch (err) {
      console.error('断开 MCP Server 失败:', err);
      throw err;
    }
  },

  loadTools: async () => {
    try {
      const tools = await api.mcp.tool.list();
      set({ tools });
    } catch (err) {
      console.error('加载 MCP 工具列表失败:', err);
    }
  },

  callTool: async (serverId, toolName, args) => {
    return api.mcp.tool.call(serverId, toolName, args);
  },
}));
