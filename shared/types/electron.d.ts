import type { FileFilter, AppInfo, SystemPathName } from './common';
import type {
  ModelConfigPublic,
  ModelConfigInput,
  ModelTestResult,
  StreamConfig,
} from './model';
import type { Conversation, ConversationSummary, Message } from './chat';
import type { PromptTemplate, VariableDef } from './prompt';
import type { Skill } from './skill';
import type { FileParseResult } from './file';
import type { MCPServerConfig, MCPTool, MCPToolResult } from './mcp';
import type { AgentSessionConfig, AgentStreamEvent } from './agent';

export interface ElectronAPI {
  // 系统
  system: {
    openExternal(url: string): Promise<void>;
    getInfo(): Promise<AppInfo>;
    getPath(name: SystemPathName): Promise<string>;
  };

  // 窗口
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
    isMaximized(): Promise<boolean>;
  };

  // 存储
  store: {
    get<T>(key: string, defaultValue?: T): Promise<T>;
    set(key: string, value: unknown): Promise<void>;
  };

  // AI
  ai: {
    startStream(requestId: string, messages: Message[], config: StreamConfig): Promise<void>;
    cancelStream(requestId: string): Promise<void>;
    onStreamChunk(requestId: string, callback: (chunk: string) => void): () => void;
    onStreamDone(requestId: string, callback: () => void): () => void;
    onStreamError(requestId: string, callback: (error: string) => void): () => void;
    onStreamToolCall(requestId: string, callback: (toolCalls: Array<{ id: string; name: string; arguments: string }>) => void): () => void;
    onStreamToolResult(requestId: string, callback: (result: { id: string; name: string; result: string; isError: boolean }) => void): () => void;
  };

  // 模型
  model: {
    list(): Promise<ModelConfigPublic[]>;
    save(config: ModelConfigInput): Promise<void>;
    delete(id: string): Promise<void>;
    test(config: ModelConfigInput): Promise<ModelTestResult>;
  };

  // 数据库
  db: {
    conversations: {
      list(options?: { limit?: number; offset?: number; search?: string }): Promise<ConversationSummary[]>;
      get(id: string): Promise<Conversation | null>;
      save(conversation: Conversation): Promise<void>;
      delete(id: string): Promise<void>;
      updateTitle(id: string, title: string): Promise<void>;
    };
    messages: {
      list(conversationId: string): Promise<Message[]>;
      save(conversationId: string, message: Message): Promise<void>;
    };
  };

  // 文件
  file: {
    selectDialog(filters?: FileFilter[]): Promise<string[] | null>;
    export(data: string, defaultName: string, format: 'md' | 'json' | 'txt'): Promise<string | null>;
    read(filePath: string): Promise<FileParseResult>;
    info(filePath: string): Promise<{ name: string; extension: string; size: number; isText: boolean; isImage: boolean; language?: string }>;
  };

  // Prompt 模板
  prompt: {
    list(options?: { category?: string; search?: string; favorite?: boolean }): Promise<PromptTemplate[]>;
    get(id: string): Promise<PromptTemplate | null>;
    save(data: Partial<PromptTemplate>): Promise<void>;
    delete(id: string): Promise<void>;
    increment(id: string): Promise<void>;
    categories(): Promise<string[]>;
    interpolate(content: string, variables: Record<string, string>): Promise<string>;
  };

  // Skill
  skill: {
    list(options?: { category?: string; search?: string }): Promise<Skill[]>;
    get(id: string): Promise<Skill | null>;
    save(data: Partial<Skill>): Promise<void>;
    delete(id: string): Promise<void>;
  };

  // MCP
  mcp: {
    server: {
      list(): Promise<(MCPServerConfig & { status: string })[]>;
      save(config: MCPServerConfig): Promise<void>;
      delete(id: string): Promise<void>;
      connect(id: string): Promise<{ success: boolean; tools: MCPTool[]; status: string }>;
      disconnect(id: string): Promise<{ success: boolean; status: string }>;
    };
    tool: {
      list(serverId?: string): Promise<MCPTool[]>;
      call(serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult>;
    };
    status(): Promise<Record<string, string>>;
  };

  // Agent
  agent: {
    checkCli(): Promise<{ available: boolean; version?: string; path?: string; error?: string }>;
    getCliVersion(): Promise<string | undefined>;
    selectDirectory(): Promise<string | null>;
    sessionStart(config: AgentSessionConfig): Promise<{ sessionId: string }>;
    sessionCancel(sessionId: string): Promise<void>;
    sessionStop(sessionId: string): Promise<void>;
    onStreamEvent(sessionId: string, callback: (event: AgentStreamEvent) => void): () => void;
    onStreamDone(sessionId: string, callback: () => void): () => void;
    onStreamError(sessionId: string, callback: (error: string) => void): () => void;
  };

  // 主题
  theme: {
    getShouldUseDark(): Promise<boolean>;
    onSystemUpdated(callback: (dark: boolean) => void): () => void;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
