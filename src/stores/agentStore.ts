import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentContentBlock, AgentToolUseBlock, AgentSessionConfig, AgentStreamEvent } from '@shared/types/agent';
import { api } from '../services/ipcBridge';

let _currentCleanup: (() => void) | null = null;

interface PendingApproval {
  toolName: string;
  toolInput: Record<string, unknown>;
  reason: string;
}

/** session 内已批准的工具（不持久化） */
let _sessionApprovedTools: string[] = [];

/** 需要授权的危险工具 */
const DANGEROUS_TOOLS = new Set(['Write', 'Edit', 'Bash', 'WebFetch', 'NotebookEdit']);

/** 始终预授权的只读工具 */
const SAFE_TOOLS = ['Read', 'Grep', 'Glob', 'WebSearch', 'TodoWrite'];

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

interface AgentState {
  cliAvailable: boolean;
  cliVersion: string | null;
  cliCheckError: string | null;

  sessionId: string | null;
  cwd: string;
  status: 'idle' | 'running' | 'waiting_input' | 'error';
  model: string | null;
  agentModel: string;
  agentModels: Record<string, string>;
  currentCost: number;
  currentDuration: number;
  currentTurns: number;

  messages: AgentMessage[];
  error: string | null;
  pendingApproval: PendingApproval | null;

  checkCli: () => Promise<void>;
  getCliVersion: () => void;
  selectDirectory: () => Promise<void>;
  setCwd: (cwd: string) => void;
  loadAgentModel: () => Promise<void>;
  setAgentModel: (model: string) => void;
  sendMessage: (content: string) => Promise<void>;
  cancelCurrentTurn: () => Promise<void>;
  stopSession: () => Promise<void>;
  clearMessages: () => Promise<void>;
  approveTool: (mode: 'once' | 'always') => Promise<void>;
  denyTool: () => void;
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
          let newMessages: AgentMessage[];

          if (existingIdx !== -1) {
            const existing = s.messages[existingIdx];
            const newBlocks = event.message.content.filter((nb) => {
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
            const msg: AgentMessage = {
              id: msgId, sessionId, role: 'assistant',
              blocks: event.message.content, createdAt: Date.now(),
            };
            newMessages = [...s.messages, msg];
          }

          // 主动检测危险工具调用
          const pendingDangerousTool = event.message.content.find(
            (b) => b.type === 'tool_use' && DANGEROUS_TOOLS.has(b.name)
          );
          const pendingApproval: PendingApproval | null = pendingDangerousTool && pendingDangerousTool.type === 'tool_use'
            ? { toolName: pendingDangerousTool.name, toolInput: pendingDangerousTool.input, reason: '该操作将修改文件或执行命令' }
            : s.pendingApproval;

          return { messages: newMessages, status: 'running' as const, pendingApproval };
        });
      }
      break;

    case 'user':
      if (event.message_user?.content) {
        const toolResultBlocks = event.message_user.content.filter(
          (b) => b.type === 'tool_result'
        );
        if (toolResultBlocks.length > 0) {
          // 检查是否有危险工具的权限拒绝错误
          const currentState = useAgentStore.getState();
          for (const result of toolResultBlocks) {
            if (!result.is_error) continue;
            // 在所有消息中查找对应的 tool_use（按 tool_use_id 精确匹配）
            let foundToolUse: AgentToolUseBlock | null = null;
            for (let i = currentState.messages.length - 1; i >= 0; i--) {
              const msg = currentState.messages[i];
              if (msg.role !== 'assistant') continue;
              const match = msg.blocks.find(
                (b): b is AgentToolUseBlock => b.type === 'tool_use' && b.id === result.tool_use_id
              );
              if (match) { foundToolUse = match; break; }
            }
            console.log(`[Agent] tool_result error: tool=${foundToolUse?.name || 'unknown'} id=${result.tool_use_id.slice(0, 8)} dangerous=${foundToolUse ? DANGEROUS_TOOLS.has(foundToolUse.name) : 'N/A'}`);
            if (foundToolUse && DANGEROUS_TOOLS.has(foundToolUse.name)) {
              // 危险工具被拒绝 → 展示审批卡片
              console.log(`[Agent] 危险工具 ${foundToolUse.name} 被拒绝，展示审批`);
              useAgentStore.setState({
                pendingApproval: {
                  toolName: foundToolUse.name,
                  toolInput: foundToolUse.input,
                  reason: '该操作需要授权才能执行',
                },
                status: 'waiting_input',
              });
              return;
            }
          }

          // 非危险工具的正常处理：将 tool_result 追加到对应消息
          useAgentStore.setState((s) => {
            const msgs = [...s.messages];
            const unmatched: AgentContentBlock[] = [];
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
      console.log(`[Agent] result ${sessionId.slice(0, 8)} error=${event.is_error} cost=${event.total_cost_usd} result=${(event.result || '').slice(0, 200)}`);
      useAgentStore.setState((s) => ({
        messages: completeToolUseForSession(sessionId, s.messages),
        currentCost: s.currentCost + (event.total_cost_usd || 0),
        currentDuration: s.currentDuration + (event.duration_ms || 0),
        currentTurns: s.currentTurns + (event.num_turns || 1),
        status: event.is_error ? 'error' : 'waiting_input',
        error: event.is_error ? (event.result || 'Agent 执行出错') : null,
        pendingApproval: s.pendingApproval || null,
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
  console.log(`[Agent] 注册监听器 ${sessionId.slice(0, 8)}`);

  const removeEvent = api.agent.onStreamEvent(sessionId, (event) => {
    console.log(`[Agent] 事件 ${sessionId.slice(0, 8)} type=${(event as AgentStreamEvent).type}`);
    handleStreamEvent(sessionId, event);
  });
  const removeDone = api.agent.onStreamDone(sessionId, () => {
    console.log(`[Agent] done ${sessionId.slice(0, 8)} status=${useAgentStore.getState().status}`);
    _currentCleanup?.();
    _currentCleanup = null;
    // 安全网：如果没收到 result 事件进程就退出了，重置为 waiting_input 并补全 tool_use
    useAgentStore.setState((s) => {
      if (s.status !== 'running') return {};
      return {
        messages: completeToolUseForSession(sessionId, s.messages),
        status: 'waiting_input' as const,
      };
    });
  });
  const removeError = api.agent.onStreamError(sessionId, (err) => {
    console.log(`[Agent] error ${sessionId.slice(0, 8)}: ${err}`);
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
  agentModel: '',
  agentModels: {},
  currentCost: 0,
  currentDuration: 0,
  currentTurns: 0,
  messages: [],
  error: null,
  pendingApproval: null,

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

  getCliVersion: () => {
    // 异步获取，不阻塞页面渲染
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

  loadAgentModel: async () => {
    const [model, models] = await Promise.all([
      api.store.get('claude-model', ''),
      api.store.get<Record<string, string>>('claude-models', {}),
    ]);
    set({ agentModel: model || '', agentModels: models || {} });
  },

  setAgentModel: (model) => {
    set({ agentModel: model });
    api.store.set('claude-model', model).catch(console.error);
  },

  sendMessage: async (content) => {
    const { cwd, status, pendingApproval } = get();
    console.log(`[Agent] sendMessage status=${status} pending=${!!pendingApproval}`);
    if (!cwd || status === 'running' || pendingApproval) return;

    // 清理上一轮的监听器 + 杀死残留进程
    _currentCleanup?.();
    _currentCleanup = null;
    const prevSessionId = get().sessionId;
    if (prevSessionId) {
      console.log(`[Agent] 杀死旧进程 ${prevSessionId.slice(0, 8)}`);
      await api.agent.sessionStop(prevSessionId).catch(() => {});
    }

    // 新会话时重置 session 内批准的工具
    _sessionApprovedTools = [];

    // 收集历史消息作为上下文（最近几轮对话）
    const historyMessages = get().messages;
    const contextParts: string[] = [];
    for (const msg of historyMessages) {
      if (msg.role === 'user') {
        const text = msg.blocks.find((b) => b.type === 'text');
        if (text && 'text' in text) contextParts.push(`User: ${text.text}`);
      } else if (msg.role === 'assistant') {
        const text = msg.blocks.find((b) => b.type === 'text');
        if (text && 'text' in text) contextParts.push(`Assistant: ${text.text}`);
      }
    }
    // 只保留最近 10 条消息作为上下文
    const recentContext = contextParts.slice(-10);
    const fullMessage = recentContext.length > 0
      ? `之前的对话:\n${recentContext.join('\n')}\n\n用户的新消息:\n${content}`
      : content;

    // 添加用户消息到 UI
    const userMsg: AgentMessage = {
      id: uuidv4(),
      sessionId: '',
      role: 'user',
      blocks: [{ type: 'text', text: content }],
      createdAt: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], status: 'running', error: null }));

    try {
      const [apiKey, baseUrl, persistedApproved] = await Promise.all([
        api.store.get('claude-api-key', ''),
        api.store.get('claude-base-url', ''),
        api.store.get<string[]>('claude-approved-tools', []),
      ]);
      const allApproved = [...new Set([...SAFE_TOOLS, ...(persistedApproved || []), ..._sessionApprovedTools])];
      const config: AgentSessionConfig = {
        cwd,
        message: fullMessage,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        model: get().agentModel || undefined,
        allowedTools: allApproved,
      };
      console.log(`[Agent] 启动CLI model=${config.model || 'default'}`);
      const { sessionId: newId } = await api.agent.sessionStart(config);
      console.log(`[Agent] 新会话 ${newId.slice(0, 8)}`);
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

  cancelCurrentTurn: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    _currentCleanup?.();
    _currentCleanup = null;
    await api.agent.sessionCancel(sessionId).catch(console.error);
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
    set({ messages: [], currentCost: 0, currentDuration: 0, currentTurns: 0, status: 'idle', sessionId: null, error: null, pendingApproval: null });
  },

  approveTool: async (mode) => {
    const { pendingApproval, messages } = get();
    if (!pendingApproval) return;

    if (mode === 'always') {
      const approved: string[] = await api.store.get('claude-approved-tools', []);
      if (!approved.includes(pendingApproval.toolName)) {
        await api.store.set('claude-approved-tools', [...approved, pendingApproval.toolName]);
      }
    }
    if (!_sessionApprovedTools.includes(pendingApproval.toolName)) {
      _sessionApprovedTools.push(pendingApproval.toolName);
    }

    // 获取最后一条用户消息并重新发送
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const lastText = lastUserMsg?.blocks.find((b) => b.type === 'text');
    const content = lastText && 'text' in lastText ? lastText.text : '';

    set({ pendingApproval: null });

    if (content) {
      await get().sendMessage(content);
    }
  },

  denyTool: () => {
    const { status } = get();
    if (status === 'running') {
      get().stopSession();
    } else {
      set({ pendingApproval: null });
    }
  },
}));
