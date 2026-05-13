import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentContentBlock, AgentSessionConfig, AgentStreamEvent } from '@shared/types/agent';
import { api } from '../services/ipcBridge';

let _currentCleanup: (() => void) | null = null;

interface AgentState {
  cliAvailable: boolean;
  cliVersion: string | null;
  cliCheckError: string | null;

  sessionId: string | null;
  cwd: string;
  status: 'idle' | 'running' | 'waiting_input' | 'error';
  model: string | null;
  currentCost: number;
  currentDuration: number;

  messages: AgentMessage[];
  error: string | null;

  checkCli: () => Promise<void>;
  getCliVersion: () => Promise<void>;
  selectDirectory: () => Promise<void>;
  setCwd: (cwd: string) => void;
  sendMessage: (content: string) => Promise<void>;
  cancelCurrentTurn: () => Promise<void>;
  stopSession: () => Promise<void>;
  clearMessages: () => Promise<void>;
}

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
          if (existingIdx !== -1) {
            // 同一轮调用中 CLI 可能分多次发送同一消息（先 thinking+tool_use，后 text）
            // 合并新出现的块，跳过已存在的
            const existing = s.messages[existingIdx];
            const newBlocks = event.message.content.filter((nb) => {
              if (nb.type === 'tool_result') return false; // 由 user 事件处理
              if (nb.type === 'tool_use') return !existing.blocks.some(b => b.type === 'tool_use' && b.id === nb.id);
              // text/thinking：内容相同则跳过
              if (nb.type === 'text') return !existing.blocks.some(b => b.type === 'text' && b.text === nb.text);
              if (nb.type === 'thinking') return !existing.blocks.some(b => b.type === 'thinking' && b.thinking === nb.thinking);
              return true;
            });
            if (newBlocks.length === 0) return {};
            const msgs = [...s.messages];
            msgs[existingIdx] = { ...existing, blocks: [...existing.blocks, ...newBlocks] };
            return { messages: msgs };
          }
          const msg: AgentMessage = {
            id: msgId,
            sessionId,
            role: 'assistant',
            blocks: event.message.content,
            createdAt: Date.now(),
          };
          return { messages: [...s.messages, msg], status: 'running' as const };
        });
      }
      break;

    case 'user':
      if (event.message_user?.content) {
        const toolResultBlocks = event.message_user.content.filter(
          (b) => b.type === 'tool_result'
        );
        if (toolResultBlocks.length > 0) {
          useAgentStore.setState((s) => {
            const msgs = [...s.messages];
            const unmatched: AgentContentBlock[] = [];
            // 按 tool_use_id 精确匹配到包含对应 tool_use 的消息
            for (const result of toolResultBlocks) {
              let matched = false;
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === 'assistant' &&
                    msgs[i].blocks.some(b => b.type === 'tool_use' && b.id === result.tool_use_id)) {
                  msgs[i] = {
                    ...msgs[i],
                    blocks: [...msgs[i].blocks, result],
                  };
                  matched = true;
                  break;
                }
              }
              if (!matched) unmatched.push(result);
            }
            // 兜底：未匹配的结果追加到最后一条 assistant 消息
            if (unmatched.length > 0) {
              for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === 'assistant') {
                  msgs[i] = {
                    ...msgs[i],
                    blocks: [...msgs[i].blocks, ...unmatched],
                  };
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
        currentCost: s.currentCost + (event.total_cost_usd || 0),
        currentDuration: event.duration_ms || 0,
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

function registerStreamListeners(sessionId: string) {
  _currentCleanup?.();

  const removeEvent = api.agent.onStreamEvent(sessionId, (event) => {
    handleStreamEvent(sessionId, event);
  });
  const removeDone = api.agent.onStreamDone(sessionId, () => {
    _currentCleanup?.();
    _currentCleanup = null;
    // 安全网：如果没收到 result 事件进程就退出了，重置为 waiting_input
    useAgentStore.setState((s) => {
      if (s.status === 'running') return { status: 'waiting_input' as const };
      return {};
    });
  });
  const removeError = api.agent.onStreamError(sessionId, (err) => {
    _currentCleanup?.();
    _currentCleanup = null;
    useAgentStore.setState({ status: 'error', error: err });
  });

  _currentCleanup = () => { removeEvent(); removeDone(); removeError(); };
}

export const useAgentStore = create<AgentState>((set, get) => ({
  cliAvailable: false,
  cliVersion: null,
  cliCheckError: null,
  sessionId: null,
  cwd: '',
  status: 'idle',
  model: null,
  currentCost: 0,
  currentDuration: 0,
  messages: [],
  error: null,

  checkCli: async () => {
    try {
      const result = await api.agent.checkCli();
      set({
        cliAvailable: result.available,
        cliVersion: result.version || null,
        cliCheckError: result.error || null,
      });
    } catch (err) {
      set({
        cliAvailable: false,
        cliCheckError: err instanceof Error ? err.message : 'CLI 检测失败',
      });
    }
  },

  getCliVersion: async () => {
    try {
      const version = await api.agent.getCliVersion();
      set({ cliVersion: version || null });
    } catch {
      // 静默失败
    }
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

  sendMessage: async (content) => {
    const { cwd, status } = get();
    if (!cwd || status === 'running') return;

    // 读取上一轮的 sessionId 用于 resume
    const prevSessionId = get().sessionId;

    // 清理上一轮的监听器（如果有残留的进程）
    _currentCleanup?.();
    _currentCleanup = null;

    // 添加用户消息到 UI
    const userMsg: AgentMessage = {
      id: uuidv4(),
      sessionId: prevSessionId || '',
      role: 'user',
      blocks: [{ type: 'text', text: content }],
      createdAt: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], status: 'running', error: null }));

    try {
      const apiKey = await api.store.get('claude-api-key', '');
      const baseUrl = await api.store.get('claude-base-url', '');
      const model = await api.store.get('claude-model', '');
      const config: AgentSessionConfig = {
        cwd,
        message: content,
        resume: prevSessionId || undefined,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        model: model || undefined,
      };
      const { sessionId: newId } = await api.agent.sessionStart(config);
      registerStreamListeners(newId);
      set({ sessionId: newId });
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : '发送消息失败',
      });
    }
  },

  cancelCurrentTurn: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    _currentCleanup?.();
    _currentCleanup = null;
    await api.agent.sessionStop(sessionId).catch(console.error);
    set({ status: 'waiting_input' });
  },

  stopSession: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    _currentCleanup?.();
    _currentCleanup = null;
    await api.agent.sessionStop(sessionId).catch(console.error);
    set({ sessionId: null, status: 'idle' });
  },

  clearMessages: async () => {
    const { sessionId, status } = get();
    // 如果正在运行，先停止进程
    if (status === 'running' && sessionId) {
      _currentCleanup?.();
      _currentCleanup = null;
      await api.agent.sessionStop(sessionId).catch(console.error);
    }
    set({ messages: [], currentCost: 0, currentDuration: 0, status: 'idle', sessionId: null, error: null });
  },
}));
