import type {
  Message, StreamConfig, Conversation, FileFilter,
  PromptTemplate, Skill,
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
};
