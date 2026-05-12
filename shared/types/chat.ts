/** 对话会话 */
export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  systemPrompt?: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  metadata: {
    totalTokens?: number;
    messageCount?: number;
  };
}

/** 对话摘要（列表用） */
export interface ConversationSummary {
  id: string;
  title: string;
  modelId: string;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** 消息 */
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  tokenCount?: number;
  createdAt: number;
  parentMessageId?: string;
}

/** 文件附件 */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  path: string;
  preview?: string;
}

/** 工具调用 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  result?: string;
}
