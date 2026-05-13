import type {
  Message, StreamConfig, Conversation, FileFilter,
  PromptTemplate, Skill, MCPServerConfig, MCPTool, MCPToolResult,
  AgentSessionConfig, AgentStreamEvent,
} from '@shared/types';

/** 渲染进程 IPC 调用代理 */
export const api = {
  // 存储
  store: {
    get: <T>(key: string, defaultValue?: T) =>
      window.electronAPI.store.get<T>(key, defaultValue),
    set: (key: string, value: unknown) =>
      window.electronAPI.store.set(key, value),
  },

  // 模型
  model: {
    list: () => window.electronAPI.model.list(),
    save: (config: Parameters<typeof window.electronAPI.model.save>[0]) =>
      window.electronAPI.model.save(config),
    delete: (id: string) => window.electronAPI.model.delete(id),
    test: (config: Parameters<typeof window.electronAPI.model.test>[0]) =>
      window.electronAPI.model.test(config),
  },

  // AI
  ai: {
    startStream: (requestId: string, messages: Message[], config: StreamConfig) =>
      window.electronAPI.ai.startStream(requestId, messages, config),
    cancelStream: (requestId: string) =>
      window.electronAPI.ai.cancelStream(requestId),
    onStreamChunk: (requestId: string, cb: (chunk: string) => void) =>
      window.electronAPI.ai.onStreamChunk(requestId, cb),
    onStreamDone: (requestId: string, cb: () => void) =>
      window.electronAPI.ai.onStreamDone(requestId, cb),
    onStreamError: (requestId: string, cb: (err: string) => void) =>
      window.electronAPI.ai.onStreamError(requestId, cb),
    onStreamToolCall: (requestId: string, cb: (toolCalls: Array<{ id: string; name: string; arguments: string }>) => void) =>
      window.electronAPI.ai.onStreamToolCall(requestId, cb),
    onStreamToolResult: (requestId: string, cb: (result: { id: string; name: string; result: string; isError: boolean }) => void) =>
      window.electronAPI.ai.onStreamToolResult(requestId, cb),
  },

  // 数据库
  db: {
    conversations: {
      list: (options?: { limit?: number; offset?: number; search?: string }) =>
        window.electronAPI.db.conversations.list(options),
      get: (id: string) => window.electronAPI.db.conversations.get(id),
      save: (conv: Conversation) => window.electronAPI.db.conversations.save(conv),
      delete: (id: string) => window.electronAPI.db.conversations.delete(id),
      updateTitle: (id: string, title: string) =>
        window.electronAPI.db.conversations.updateTitle(id, title),
    },
    messages: {
      list: (conversationId: string) =>
        window.electronAPI.db.messages.list(conversationId),
      save: (conversationId: string, msg: Message) =>
        window.electronAPI.db.messages.save(conversationId, msg),
    },
  },

  // 文件
  file: {
    selectDialog: (filters?: FileFilter[]) =>
      window.electronAPI.file.selectDialog(filters),
    export: (data: string, defaultName: string, format: 'md' | 'json' | 'txt') =>
      window.electronAPI.file.export(data, defaultName, format),
    read: (filePath: string) => window.electronAPI.file.read(filePath),
    info: (filePath: string) => window.electronAPI.file.info(filePath),
  },

  // Prompt 模板
  prompt: {
    list: (options?: { category?: string; search?: string; favorite?: boolean }) =>
      window.electronAPI.prompt.list(options),
    get: (id: string) => window.electronAPI.prompt.get(id),
    save: (data: Partial<PromptTemplate>) => window.electronAPI.prompt.save(data),
    delete: (id: string) => window.electronAPI.prompt.delete(id),
    increment: (id: string) => window.electronAPI.prompt.increment(id),
    categories: () => window.electronAPI.prompt.categories(),
    interpolate: (content: string, variables: Record<string, string>) =>
      window.electronAPI.prompt.interpolate(content, variables),
  },

  // Skill
  skill: {
    list: (options?: { category?: string; search?: string }) =>
      window.electronAPI.skill.list(options),
    get: (id: string) => window.electronAPI.skill.get(id),
    save: (data: Partial<Skill>) => window.electronAPI.skill.save(data),
    delete: (id: string) => window.electronAPI.skill.delete(id),
  },

  // Agent
  agent: {
    checkCli: () => window.electronAPI.agent.checkCli(),
    getCliVersion: () => window.electronAPI.agent.getCliVersion(),
    selectDirectory: () => window.electronAPI.agent.selectDirectory(),
    sessionCreate: (config: AgentSessionConfig) =>
      window.electronAPI.agent.sessionCreate(config),
    sessionSend: (sessionId: string, content: string) =>
      window.electronAPI.agent.sessionSend(sessionId, content),
    sessionStop: (sessionId: string) =>
      window.electronAPI.agent.sessionStop(sessionId),
    sessionPermissionRespond: (sessionId: string, toolUseId: string, approved: boolean) =>
      window.electronAPI.agent.sessionPermissionRespond(sessionId, toolUseId, approved),
    onStreamEvent: (sessionId: string, cb: (event: AgentStreamEvent) => void) =>
      window.electronAPI.agent.onStreamEvent(sessionId, cb),
    onStreamDone: (sessionId: string, cb: () => void) =>
      window.electronAPI.agent.onStreamDone(sessionId, cb),
    onStreamError: (sessionId: string, cb: (error: string) => void) =>
      window.electronAPI.agent.onStreamError(sessionId, cb),
  },

  // MCP
  mcp: {
    server: {
      list: (): Promise<(MCPServerConfig & { status: string })[]> =>
        window.electronAPI.mcp.server.list(),
      save: (config: MCPServerConfig) => window.electronAPI.mcp.server.save(config),
      delete: (id: string) => window.electronAPI.mcp.server.delete(id),
      connect: (id: string): Promise<{ success: boolean; tools: MCPTool[]; status: string }> =>
        window.electronAPI.mcp.server.connect(id),
      disconnect: (id: string) => window.electronAPI.mcp.server.disconnect(id),
    },
    tool: {
      list: (serverId?: string): Promise<MCPTool[]> =>
        window.electronAPI.mcp.tool.list(serverId),
      call: (serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> =>
        window.electronAPI.mcp.tool.call(serverId, toolName, args),
    },
    status: (): Promise<Record<string, string>> => window.electronAPI.mcp.status(),
  },
};
