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

  // system init 事件
  cwd?: string;
  session_id?: string;
  tools?: string[];
  model?: string;
  permissionMode?: string;

  // assistant 事件
  message?: {
    id: string;
    role: 'assistant';
    model?: string;
    content: AgentContentBlock[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  parent_tool_use_id?: string | null;

  // user 事件（工具执行结果回显）
  message_user?: {
    role: 'user';
    content: AgentContentBlock[];
  };

  // result 事件
  result?: string;
  is_error?: boolean;
  total_cost_usd?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  stop_reason?: string;
  terminal_reason?: string;
  permission_denials?: unknown[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  // error 事件
  error?: string;
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

/** 权限模式 */
export type AgentPermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';

/** Agent 会话配置 */
export interface AgentSessionConfig {
  cwd: string;
  message: string;
  sessionId?: string; // 传入已有 session-id 以恢复会话
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  permissionMode?: AgentPermissionMode;
  tools?: string[];
  maxTurns?: number;
  maxBudgetUsd?: number;
}
