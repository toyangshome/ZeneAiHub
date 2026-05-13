import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ===== 系统 =====
  system: {
    openExternal: (url: string) => ipcRenderer.invoke('system:open-external', url),
    getInfo: () => ipcRenderer.invoke('system:get-info'),
    getPath: (name: string) => ipcRenderer.invoke('system:get-path', name),
  },

  // ===== 窗口控制 =====
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },

  // ===== 存储 =====
  store: {
    get: <T>(key: string, defaultValue?: T) =>
      ipcRenderer.invoke('store:get', key, defaultValue),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke('store:set', key, value),
  },

  // ===== AI 流式对话 =====
  ai: {
    startStream: (requestId: string, messages: unknown[], config: unknown) =>
      ipcRenderer.invoke('ai:stream:start', requestId, messages, config),
    cancelStream: (requestId: string) =>
      ipcRenderer.invoke('ai:stream:cancel', requestId),
    onStreamChunk: (requestId: string, callback: (chunk: string) => void) => {
      const channel = `ai:stream:chunk:${requestId}`;
      const handler = (_event: Electron.IpcRendererEvent, data: string) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    },
    onStreamDone: (requestId: string, callback: () => void) => {
      const channel = `ai:stream:done:${requestId}`;
      const handler = () => callback();
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    },
    onStreamError: (requestId: string, callback: (error: string) => void) => {
      const channel = `ai:stream:error:${requestId}`;
      const handler = (_event: Electron.IpcRendererEvent, err: string) => callback(err);
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    },
    onStreamToolCall: (requestId: string, callback: (toolCalls: Array<{ id: string; name: string; arguments: string }>) => void) => {
      const channel = `ai:stream:tool-call:${requestId}`;
      const handler = (_event: Electron.IpcRendererEvent, data: Array<{ id: string; name: string; arguments: string }>) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    },
    onStreamToolResult: (requestId: string, callback: (result: { id: string; name: string; result: string; isError: boolean }) => void) => {
      const channel = `ai:stream:tool-result:${requestId}`;
      const handler = (_event: Electron.IpcRendererEvent, data: { id: string; name: string; result: string; isError: boolean }) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    },
  },

  // ===== 模型 =====
  model: {
    list: () => ipcRenderer.invoke('model:list'),
    save: (config: unknown) => ipcRenderer.invoke('model:save', config),
    delete: (id: string) => ipcRenderer.invoke('model:delete', id),
    test: (config: unknown) => ipcRenderer.invoke('model:test', config),
  },

  // ===== 数据库 =====
  db: {
    conversations: {
      list: (options?: unknown) => ipcRenderer.invoke('db:conversation:list', options),
      get: (id: string) => ipcRenderer.invoke('db:conversation:get', id),
      save: (conv: unknown) => ipcRenderer.invoke('db:conversation:save', conv),
      delete: (id: string) => ipcRenderer.invoke('db:conversation:delete', id),
      updateTitle: (id: string, title: string) =>
        ipcRenderer.invoke('db:conversation:update-title', id, title),
    },
    messages: {
      list: (conversationId: string) =>
        ipcRenderer.invoke('db:message:list', conversationId),
      save: (conversationId: string, message: unknown) =>
        ipcRenderer.invoke('db:message:save', conversationId, message),
    },
  },

  // ===== 文件 =====
  file: {
    selectDialog: (filters?: unknown[]) =>
      ipcRenderer.invoke('file:select-dialog', filters),
    export: (data: string, defaultName: string, format: string) =>
      ipcRenderer.invoke('file:export', data, defaultName, format),
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    info: (filePath: string) => ipcRenderer.invoke('file:info', filePath),
  },

  // ===== Prompt 模板 =====
  prompt: {
    list: (options?: unknown) => ipcRenderer.invoke('prompt:list', options),
    get: (id: string) => ipcRenderer.invoke('prompt:get', id),
    save: (data: unknown) => ipcRenderer.invoke('prompt:save', data),
    delete: (id: string) => ipcRenderer.invoke('prompt:delete', id),
    increment: (id: string) => ipcRenderer.invoke('prompt:increment', id),
    categories: () => ipcRenderer.invoke('prompt:categories'),
    interpolate: (content: string, variables: Record<string, string>) =>
      ipcRenderer.invoke('prompt:interpolate', content, variables),
  },

  // ===== Skill =====
  skill: {
    list: (options?: unknown) => ipcRenderer.invoke('skill:list', options),
    get: (id: string) => ipcRenderer.invoke('skill:get', id),
    save: (data: unknown) => ipcRenderer.invoke('skill:save', data),
    delete: (id: string) => ipcRenderer.invoke('skill:delete', id),
  },

  // ===== Agent =====
  agent: {
    checkCli: () => ipcRenderer.invoke('agent:check-cli'),
    getCliVersion: () => ipcRenderer.invoke('agent:get-cli-version'),
    selectDirectory: () => ipcRenderer.invoke('agent:select-directory'),
    sessionCreate: (config: unknown) => ipcRenderer.invoke('agent:session:create', config),
    sessionSend: (sessionId: string, content: string) =>
      ipcRenderer.invoke('agent:session:send', sessionId, content),
    sessionStop: (sessionId: string) =>
      ipcRenderer.invoke('agent:session:stop', sessionId),
    onStreamEvent: (sessionId: string, callback: (event: unknown) => void) => {
      const channel = `agent:session:stream:${sessionId}`;
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    },
    onStreamDone: (sessionId: string, callback: () => void) => {
      const channel = `agent:session:done:${sessionId}`;
      const handler = () => callback();
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    },
    onStreamError: (sessionId: string, callback: (error: string) => void) => {
      const channel = `agent:session:error:${sessionId}`;
      const handler = (_event: Electron.IpcRendererEvent, err: string) => callback(err);
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    },
  },

  // ===== MCP =====
  mcp: {
    server: {
      list: () => ipcRenderer.invoke('mcp:server:list'),
      save: (config: unknown) => ipcRenderer.invoke('mcp:server:save', config),
      delete: (id: string) => ipcRenderer.invoke('mcp:server:delete', id),
      connect: (id: string) => ipcRenderer.invoke('mcp:server:connect', id),
      disconnect: (id: string) => ipcRenderer.invoke('mcp:server:disconnect', id),
    },
    tool: {
      list: (serverId?: string) => ipcRenderer.invoke('mcp:tool:list', serverId),
      call: (serverId: string, toolName: string, args: Record<string, unknown>) =>
        ipcRenderer.invoke('mcp:tool:call', serverId, toolName, args),
    },
    status: () => ipcRenderer.invoke('mcp:status'),
  },

  // ===== 主题 =====
  theme: {
    getShouldUseDark: () => ipcRenderer.invoke('theme:get-should-use-dark'),
    onSystemUpdated: (callback: (dark: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, dark: boolean) => callback(dark);
      ipcRenderer.on('theme:system-updated', handler);
      return () => { ipcRenderer.removeListener('theme:system-updated', handler); };
    },
  },
});
