import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentContentBlock, AgentSessionConfig, AgentStreamEvent, AgentPermissionMode } from '@shared/types/agent';
import { api } from '../services/ipcBridge';

// ========== 模块级状态 ==========

let _currentCleanup: (() => void) | null = null;

// ========== 工具函数 ==========

/** 补全当前 session 中未收到 tool_result 的 tool_use 为已完成状态 */
function completeToolUseForSession(sessionId: string, messages: AgentMessage[]): AgentMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'assistant' || msg.sessionId !== sessionId) return msg;
    const toolUseIds: string[] = [];
    const completedIds = new Set<string>();
    for (const b of msg.blocks) {
      if (b.type === 'tool_use') toolUseIds.push(b.id);
      else if (b.type === 'tool_result') completedIds.add(b.tool_use_id);
    }
    const missing = toolUseIds.filter((id) => !completedIds.has(id));
    if (missing.length === 0) return msg;
    const syntheticResults = missing.map((id): AgentContentBlock => ({
      type: 'tool_result', tool_use_id: id, content: '', is_error: false,
    }));
    return { ...msg, blocks: [...msg.blocks, ...syntheticResults] };
  });
}

// ========== 流事件处理 ==========

function handleStreamEvent(sessionId: string, event: AgentStreamEvent) {
  switch (event.type) {
    case 'system':
      if (event.model) {
        useAgentStore.setState({ model: event.model });
      }
      break;

    case 'assistant':
      if (event.message?.content) {
        const msgId = event.message.id || uuidv4();
        useAgentStore.setState((s) => {
          const existingIdx = s.messages.findIndex((m) => m.id === msgId);
          let newMessages: AgentMessage[];

          if (existingIdx !== -1) {
            // 合并到已有消息（流式增量）
            const existing = s.messages[existingIdx];
            const newBlocks = event.message!.content.filter((nb) => {
              if (nb.type === 'tool_result') return false;
              if (nb.type === 'tool_use') return !existing.blocks.some(b => b.type === 'tool_use' && b.id === nb.id);
              if (nb.type === 'text') return !existing.blocks.some(b => b.type === 'text' && b.text === nb.text);
              if (nb.type === 'thinking') return !existing.blocks.some(b => b.type === 'thinking' && b.thinking === nb.thinking);
              return true;
            });
            if (newBlocks.length === 0) return {};
            newMessages = [...s.messages];
            newMessages[existingIdx] = { ...existing, blocks: [...existing.blocks, ...newBlocks] };
          } else {
            // 新消息
            const msg: AgentMessage = {
              id: msgId, sessionId, role: 'assistant',
              blocks: event.message!.content, createdAt: Date.now(),
            };
            newMessages = [...s.messages, msg];
          }

          return { messages: newMessages, status: 'running' as const };
        });
      }
      break;

    case 'user':
      // CLI 内部工具执行结果回显，追加到对应消息
      if (event.message_user?.content) {
        const toolResultBlocks = event.message_user.content.filter(
          (b) => b.type === 'tool_result'
        );
        if (toolResultBlocks.length > 0) {
          useAgentStore.setState((s) => {
            const msgs = [...s.messages];
            const unmatched: AgentContentBlock[] = [];
            for (const result of toolResultBlocks) {
              let matched = false;
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === 'assistant' &&
                    msgs[i].blocks.some(b => b.type === 'tool_use' && b.id === result.tool_use_id)) {
                  msgs[i] = { ...msgs[i], blocks: [...msgs[i].blocks, result] };
                  matched = true;
                  break;
                }
              }
              if (!matched) unmatched.push(result);
            }
            // 未匹配的追加到最后一条 assistant 消息
            if (unmatched.length > 0) {
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === 'assistant') {
                  msgs[i] = { ...msgs[i], blocks: [...msgs[i].blocks, ...unmatched] };
                  break;
                }
              }
            }
            return { messages: msgs };
          });
        }
      }
      break;

    case 'result':
      useAgentStore.setState((s) => ({
        messages: completeToolUseForSession(sessionId, s.messages),
        currentCost: s.currentCost + (event.total_cost_usd || 0),
        currentDuration: s.currentDuration + (event.duration_ms || 0),
        currentTurns: s.currentTurns + (event.num_turns || 1),
        status: event.is_error ? 'error' : 'waiting_input',
        error: event.is_error ? (event.result || 'Agent 执行出错') : null,
      }));
      break;

    case 'error':
      useAgentStore.setState({
        status: 'error',
        error: event.error || '未知错误',
      });
      break;
  }
}

// ========== 流监听注册 ==========

function registerStreamListeners(sessionId: string) {
  _currentCleanup?.();
  console.log(`[Agent] 注册监听器 ${sessionId.slice(0, 8)}`);

  const removeEvent = api.agent.onStreamEvent(sessionId, (event) => {
    handleStreamEvent(sessionId, event);
  });
  const removeDone = api.agent.onStreamDone(sessionId, () => {
    _currentCleanup?.();
    _currentCleanup = null;
    // 安全网：如果进程退出时还在 running，重置状态
    useAgentStore.setState((s) => {
      if (s.status !== 'running') return {};
      return {
        messages: completeToolUseForSession(sessionId, s.messages),
        status: 'waiting_input' as const,
      };
    });
  });
  const removeError = api.agent.onStreamError(sessionId, (err) => {
    _currentCleanup?.();
    _currentCleanup = null;
    useAgentStore.setState({ status: 'error', error: err });
  });

  _currentCleanup = () => { removeEvent(); removeDone(); removeError(); };
}

// ========== State 定义 ==========

interface AgentState {
  cliAvailable: boolean;
  cliVersion: string | null;
  cliCheckError: string | null;

  sessionId: string | null;
  cwd: string;
  status: 'idle' | 'running' | 'waiting_input' | 'error';
  model: string | null;
  permissionMode: AgentPermissionMode;
  currentCost: number;
  currentDuration: number;
  currentTurns: number;

  messages: AgentMessage[];
  error: string | null;

  // Actions
  checkCli: () => Promise<void>;
  getCliVersion: () => void;
  selectDirectory: () => Promise<void>;
  setCwd: (cwd: string) => void;
  setPermissionMode: (mode: AgentPermissionMode) => void;
  sendMessage: (content: string) => Promise<void>;
  stopSession: () => Promise<void>;
  clearMessages: () => void;
}

// ========== Store ==========

export const useAgentStore = create<AgentState>((set, get) => ({
  cliAvailable: false,
  cliVersion: null,
  cliCheckError: null,
  sessionId: null,
  cwd: '',
  status: 'idle',
  model: null,
  permissionMode: 'default',
  currentCost: 0,
  currentDuration: 0,
  currentTurns: 0,
  messages: [],
  error: null,

  checkCli: async () => {
    try {
      const result = await api.agent.checkCli();
      set({
        cliAvailable: result.available,
        cliCheckError: result.error || null,
      });
    } catch (err) {
      set({
        cliAvailable: false,
        cliCheckError: err instanceof Error ? err.message : 'CLI 检测失败',
      });
    }
  },

  getCliVersion: () => {
    api.agent.getCliVersion()
      .then((version) => { if (version) set({ cliVersion: version }); })
      .catch(() => {});
  },

  selectDirectory: async () => {
    try {
      const dir = await api.agent.selectDirectory();
      if (dir) set({ cwd: dir });
    } catch (err) {
      console.error('选择目录失败:', err);
    }
  },

  setCwd: (cwd) => set({ cwd }),

  setPermissionMode: (mode) => set({ permissionMode: mode }),

  sendMessage: async (content) => {
    const { cwd, sessionId, status } = get();
    if (!cwd || status === 'running') return;

    // 添加用户消息到 UI
    const userMsg: AgentMessage = {
      id: uuidv4(),
      sessionId: sessionId || '',
      role: 'user',
      blocks: [{ type: 'text', text: content }],
      createdAt: Date.now(),
    };
    set((s) => ({
      messages: [...s.messages, userMsg],
      status: 'running',
      error: null,
    }));

    try {
      // 如果已有活跃会话，直接发送消息
      if (sessionId && status !== 'idle') {
        await api.agent.sessionSend(sessionId, content);
        return;
      }

      // 清理旧会话
      _currentCleanup?.();
      _currentCleanup = null;
      if (sessionId) {
        await api.agent.sessionStop(sessionId).catch(() => {});
      }

      // 获取配置
      const [apiKey, baseUrl] = await Promise.all([
        api.store.get('claude-api-key', ''),
        api.store.get('claude-base-url', ''),
      ]);

      const config: AgentSessionConfig = {
        cwd,
        message: content,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        model: get().model || undefined,
        permissionMode: get().permissionMode,
      };

      const { sessionId: newId } = await api.agent.sessionCreate(config);
      registerStreamListeners(newId);
      set({ sessionId: newId });
    } catch (err) {
      console.error('[Agent] sendMessage 异常:', err);
      set({
        status: 'error',
        error: err instanceof Error ? err.message : '发送消息失败',
      });
    }
  },

  stopSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    _currentCleanup?.();
    _currentCleanup = null;
    await api.agent.sessionStop(sessionId).catch(console.error);
    set({ sessionId: null, status: 'idle' });
  },

  clearMessages: () => {
    const { sessionId, status } = get();
    if (status === 'running' && sessionId) {
      _currentCleanup?.();
      _currentCleanup = null;
      api.agent.sessionStop(sessionId).catch(() => {});
    }
    set({
      messages: [],
      currentCost: 0,
      currentDuration: 0,
      currentTurns: 0,
      status: 'idle',
      sessionId: null,
      error: null,
    });
  },
}));
