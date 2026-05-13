/** Agent 消息块类型（对应 Claude Code CLI content blocks） */

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

/** CLI stream-json 事件类型 */
export type AgentStreamEventType = 'system' | 'assistant' | 'user' | 'result' | 'error';

export interface AgentStreamEvent {
  type: AgentStreamEventType;
  subtype?: string;
  model?: string;
  cwd?: string;
  message?: {
    id: string;
    role: 'assistant';
    content: AgentContentBlock[];
  };
  message_user?: {
    role: 'user';
    content: AgentContentBlock[];
  };
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  is_error?: boolean;
  error?: string;
}

/** Agent 会话状态 */
export type AgentSessionStatus = 'idle' | 'running' | 'waiting_input' | 'error' | 'stopped';

export interface AgentSession {
  sessionId: string;
  cwd: string;
  status: AgentSessionStatus;
  model?: string;
  startedAt: number;
}

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

/** Agent 会话配置 */
export interface AgentSessionConfig {
  cwd: string;
  message: string;
  resume?: string;
  allowedTools?: string[];
  maxTurns?: number;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}
