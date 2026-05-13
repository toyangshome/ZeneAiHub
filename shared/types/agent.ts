/** Agent 消息块类型 */

export interface AgentTextBlock {
  type: 'text';
  text: string;
}

export interface AgentThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface AgentToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AgentToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type AgentContentBlock =
  | AgentTextBlock
  | AgentThinkingBlock
  | AgentToolUseBlock
  | AgentToolResultBlock;

/** 前端展示用的消息 */
export interface AgentMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  blocks: AgentContentBlock[];
  createdAt: number;
  cost?: number;
  durationMs?: number;
  numTurns?: number;
}

// TODO: 重新设计 Agent 会话配置和流事件类型
