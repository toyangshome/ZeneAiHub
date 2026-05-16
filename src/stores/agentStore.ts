import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { AgentMessage, AgentContentBlock, AgentToolResultBlock, AgentSessionConfig, AgentStreamEvent, AgentPermissionMode, AgentPendingApproval } from '@shared/types/agent';
import { api } from '../services/ipcBridge';
import { agentSessionToMarkdown } from '../pages/Agent/agentExport';

// ========== 模块级状态 ==========

let _currentCleanup: (() => void) | null = null;

/** 当前是否正在处理一个 assistant 回合（用于合并多个 assistant 事件到同一个气泡） */
let _isInAssistantTurn = false;

/** 需要授权确认的工具名 */
const DANGEROUS_TOOLS = new Set(['Bash', 'Write', 'Edit']);

/** 等待用户确认的 tool_use ID 集合 */
const _pendingApprovalIds = new Set<string>();

/** 已到达但等待确认的 tool_result，key = tool_use_id */
const _bufferedResults = new Map<string, AgentToolResultBlock>();

/** 本会话中"始终允许"的工具名集合 */
const _alwaysAllowTools = new Set<string>();

/** 保存消息到数据库（静默失败） */
function saveMsgToDb(sessionId: string, msg: AgentMessage) {
  api.agent.saveMessage({
    id: msg.id, sessionId, role: msg.role,
    blocks: msg.blocks, cost: msg.cost, durationMs: msg.durationMs, numTurns: msg.numTurns,
  }).catch((e) => console.warn('[Agent] 保存消息失败:', e));
}

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
        // 检测需要授权的危险工具
        const dangerousUses = event.message.content.filter(
          (b): b is AgentContentBlock & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
            b.type === 'tool_use' && DANGEROUS_TOOLS.has(b.name) && !_pendingApprovalIds.has(b.id)
        );
        if (dangerousUses.length > 0) {
          // 分离：已在"始终允许"列表中的自动批准，其余需要弹窗
          const needsApproval: AgentPendingApproval[] = [];
          const { sessionId: curSid } = useAgentStore.getState();
          for (const b of dangerousUses) {
            if (_alwaysAllowTools.has(b.name)) {
              if (curSid) api.agent.sessionPermissionRespond(curSid, b.id, true);
            } else {
              _pendingApprovalIds.add(b.id);
              needsApproval.push({ toolUseId: b.id, toolName: b.name, toolInput: b.input });
            }
          }
          if (needsApproval.length > 0) {
            useAgentStore.setState((s) => ({
              pendingApprovals: [...s.pendingApprovals, ...needsApproval],
            }));
          }
        }

        useAgentStore.setState((s) => {
          const newContent = event.message!.content.filter((b) => b.type !== 'tool_result');

          // 合并到当前回合的 assistant 消息中（thinking / tool_use / text 合为一个气泡）
          if (_isInAssistantTurn) {
            const lastIdx = s.messages.length - 1;
            if (lastIdx < 0 || s.messages[lastIdx].role !== 'assistant') return {};

            const existing = s.messages[lastIdx];
            const deduped = newContent.filter((nb) => {
              if (nb.type === 'tool_use') return !existing.blocks.some(b => b.type === 'tool_use' && b.id === nb.id);
              if (nb.type === 'text') return !existing.blocks.some(b => b.type === 'text' && b.text === nb.text);
              if (nb.type === 'thinking') return !existing.blocks.some(b => b.type === 'thinking' && b.thinking === nb.thinking);
              return true;
            });
            if (deduped.length === 0) return {};

            const msgs = [...s.messages];
            msgs[lastIdx] = { ...existing, blocks: [...existing.blocks, ...deduped] };
            return { messages: msgs };
          }

          // 新回合的第一个 assistant 事件：创建气泡
          _isInAssistantTurn = true;
          const msg: AgentMessage = {
            id: event.message!.id || uuidv4(),
            sessionId, role: 'assistant',
            blocks: newContent, createdAt: Date.now(),
          };
          return { messages: [...s.messages, msg], status: 'running' as const };
        });
      }
      break;

    case 'user':
      // CLI 内部工具执行结果回显，追加到对应消息
      if (event.message_user?.content) {
        const toolResultBlocks = event.message_user.content.filter(
          (b): b is AgentToolResultBlock => b.type === 'tool_result'
        );
        if (toolResultBlocks.length > 0) {
          // 分离：待审批的缓冲，已批准的直接显示
          const deferred: AgentToolResultBlock[] = [];
          const immediate: AgentToolResultBlock[] = [];
          for (const result of toolResultBlocks) {
            if (_pendingApprovalIds.has(result.tool_use_id)) {
              _bufferedResults.set(result.tool_use_id, result);
              deferred.push(result);
            } else {
              immediate.push(result);
            }
          }

          if (immediate.length > 0) {
            useAgentStore.setState((s) => {
              const msgs = [...s.messages];
              const unmatched: AgentToolResultBlock[] = [];
              for (const result of immediate) {
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
      }
      break;

    case 'result':
      // 回合结束：清理审批状态，补全未完成的 tool_use
      _pendingApprovalIds.clear();
      _bufferedResults.clear();
      useAgentStore.setState((s) => {
        const completed = completeToolUseForSession(sessionId, s.messages);
        const newCost = s.currentCost + (event.total_cost_usd || 0);
        const newDuration = s.currentDuration + (event.duration_ms || 0);
        const newTurns = s.currentTurns + (event.num_turns || 1);
        // 持久化：保存最后一条 assistant 消息（含完整 tool_result）和更新会话统计
        for (let i = completed.length - 1; i >= 0; i--) {
          if (completed[i].role === 'assistant' && completed[i].sessionId === sessionId) {
            saveMsgToDb(sessionId, {
              ...completed[i],
              cost: event.total_cost_usd, durationMs: event.duration_ms, numTurns: event.num_turns,
            });
            break;
          }
        }
        api.agent.saveSession({
          id: sessionId, projectPath: s.cwd,
          status: event.is_error ? 'error' : 'active',
          totalCost: newCost, totalTurns: newTurns,
        }).catch(() => {});
        return {
          messages: completed, pendingApprovals: [],
          currentCost: newCost, currentDuration: newDuration, currentTurns: newTurns,
          status: event.is_error ? 'error' as const : 'waiting_input' as const,
          error: event.is_error ? (event.result || 'Agent 执行出错') : null,
        };
      });
      break;

    case 'error':
      _pendingApprovalIds.clear();
      _bufferedResults.clear();
      useAgentStore.setState({
        status: 'error',
        error: event.error || '未知错误',
        pendingApprovals: [],
      });
      break;
  }
}

// ========== 流监听注册 ==========

function registerStreamListeners(sessionId: string) {
  _currentCleanup?.();

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
  pendingApprovals: AgentPendingApproval[];
  error: string | null;
  /** 从 Chat 页面传入的消息文本（一次性消费） */
  pendingMessage: string | null;

  // Actions
  checkCli: () => Promise<void>;
  getCliVersion: () => void;
  selectDirectory: () => Promise<void>;
  setCwd: (cwd: string) => void;
  setPermissionMode: (mode: AgentPermissionMode) => void;
  sendMessage: (content: string) => Promise<void>;
  stopSession: () => Promise<void>;
  clearMessages: () => void;
  approveTool: (toolUseId: string) => void;
  denyTool: (toolUseId: string) => void;
  alwaysAllowTool: (toolUseId: string, toolName: string) => void;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSessionHistory: (sessionId: string) => Promise<void>;
  exportSession: (sessionId: string) => Promise<void>;
  listSessions: () => Promise<void>;
  setPendingMessage: (text: string | null) => void;
  sessionSummaries: { id: string; title: string; projectPath: string; messageCount: number; createdAt: number; updatedAt: number; status: string }[];
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
  pendingApprovals: [],
  error: null,
  sessionSummaries: [],
  pendingMessage: null,

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

  setCwd: (cwd) => {
    set({ cwd });
    get().listSessions();
  },

  setPermissionMode: (mode) => {
    const { sessionId, status, permissionMode: oldMode } = get();
    const needRestart = sessionId && status !== 'idle'
      && (oldMode === 'bypassPermissions' || mode === 'bypassPermissions');
    if (needRestart) {
      _currentCleanup?.();
      _currentCleanup = null;
      api.agent.sessionStop(sessionId!).catch(() => {});
      set({ permissionMode: mode, sessionId: null, status: 'idle' });
    } else {
      set({ permissionMode: mode });
    }
  },

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
    _isInAssistantTurn = false; // 重置回合标志，新用户消息开始新回合
    set((s) => ({
      messages: [...s.messages, userMsg],
      status: 'running',
      error: null,
    }));

    // 持久化用户消息
    if (sessionId) {
      saveMsgToDb(sessionId, userMsg);
    }

    try {
      // 如果已有活跃会话进程，直接通过 stdin 发送消息（持久进程）
      if (sessionId && status !== 'idle') {
        await api.agent.sessionSend(sessionId, content);
        return;
      }

      // 首次或会话已结束：创建新会话进程
      _currentCleanup?.();
      _currentCleanup = null;

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

      // 创建会话记录并补填用户消息的 sessionId
      api.agent.saveSession({
        id: newId, projectPath: cwd,
        title: content.slice(0, 80), model: config.model,
      }).catch(() => {});
      // 补填已保存的用户消息（之前 sessionId 为空）
      saveMsgToDb(newId, { ...userMsg, sessionId: newId });

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
    _alwaysAllowTools.clear();
    await api.agent.sessionStop(sessionId).catch(console.error);
    set({ sessionId: null, status: 'idle' });
  },

  clearMessages: () => {
    const { sessionId, status } = get();
    _isInAssistantTurn = false;
    _alwaysAllowTools.clear();
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
      pendingApprovals: [],
      error: null,
    });
  },

  approveTool: (toolUseId) => {
    _pendingApprovalIds.delete(toolUseId);
    const buffered = _bufferedResults.get(toolUseId);
    _bufferedResults.delete(toolUseId);

    // 通知 CLI 批准
    const { sessionId } = get();
    if (sessionId) api.agent.sessionPermissionRespond(sessionId, toolUseId, true);

    if (buffered) {
      // 将缓冲的 tool_result 追加到对应消息
      useAgentStore.setState((s) => {
        const msgs = [...s.messages];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant' &&
              msgs[i].blocks.some(b => b.type === 'tool_use' && b.id === toolUseId)) {
            msgs[i] = { ...msgs[i], blocks: [...msgs[i].blocks, buffered] };
            break;
          }
        }
        return {
          messages: msgs,
          pendingApprovals: s.pendingApprovals.filter((a) => a.toolUseId !== toolUseId),
        };
      });
    } else {
      set((s) => ({
        pendingApprovals: s.pendingApprovals.filter((a) => a.toolUseId !== toolUseId),
      }));
    }
  },

  denyTool: (toolUseId) => {
    _pendingApprovalIds.delete(toolUseId);
    _bufferedResults.delete(toolUseId);

    // 通知 CLI 拒绝（而非终止会话）
    const { sessionId } = get();
    if (sessionId) api.agent.sessionPermissionRespond(sessionId, toolUseId, false);

    set((s) => ({
      pendingApprovals: s.pendingApprovals.filter((a) => a.toolUseId !== toolUseId),
    }));
  },

  alwaysAllowTool: (toolUseId, toolName) => {
    _alwaysAllowTools.add(toolName);
    _pendingApprovalIds.delete(toolUseId);
    _bufferedResults.delete(toolUseId);

    const { sessionId } = get();
    if (sessionId) api.agent.sessionPermissionRespond(sessionId, toolUseId, true);

    // 批量批准当前同类型的其他 pending approvals
    useAgentStore.setState((s) => {
      const sameType = s.pendingApprovals.filter(
        (a) => a.toolName === toolName && a.toolUseId !== toolUseId
      );
      for (const a of sameType) {
        _pendingApprovalIds.delete(a.toolUseId);
        _bufferedResults.delete(a.toolUseId);
        if (sessionId) api.agent.sessionPermissionRespond(sessionId, a.toolUseId, true);
      }
      return {
        pendingApprovals: s.pendingApprovals.filter(
          (a) => a.toolName !== toolName
        ),
      };
    });
  },

  loadSession: async (sessionId) => {
    try {
      // 停止当前会话
      const { sessionId: curSid, status } = get();
      if (curSid && status === 'running') {
        _currentCleanup?.();
        _currentCleanup = null;
        await api.agent.sessionStop(curSid).catch(() => {});
      }
      _alwaysAllowTools.clear();
      _pendingApprovalIds.clear();
      _bufferedResults.clear();
      _isInAssistantTurn = false;

      // 加载会话信息和消息
      const [session, messages] = await Promise.all([
        api.agent.getSession(sessionId),
        api.agent.listMessages(sessionId),
      ]);
      if (!session) return;

      const agentMessages: AgentMessage[] = messages.map((m) => ({
        id: m.id, sessionId: m.sessionId, role: m.role,
        blocks: m.blocks, createdAt: m.createdAt,
        cost: m.cost, durationMs: m.durationMs, numTurns: m.numTurns,
      }));

      set({
        sessionId,
        cwd: session.project_path,
        model: session.model,
        messages: agentMessages,
        currentCost: session.total_cost,
        currentTurns: session.total_turns,
        status: 'waiting_input',
        error: null,
        pendingApprovals: [],
      });
    } catch (err) {
      console.error('[Agent] loadSession 失败:', err);
    }
  },

  deleteSessionHistory: async (sessionId) => {
    await api.agent.deleteSession(sessionId).catch(console.error);
    const { sessionId: curSid } = get();
    if (curSid === sessionId) {
      _currentCleanup?.();
      _currentCleanup = null;
      _alwaysAllowTools.clear();
      set({
        messages: [], sessionId: null, status: 'idle',
        currentCost: 0, currentDuration: 0, currentTurns: 0,
        pendingApprovals: [], error: null,
      });
    }
    get().listSessions();
  },

  exportSession: async (sessionId) => {
    try {
      const [session, messages] = await Promise.all([
        api.agent.getSession(sessionId),
        api.agent.listMessages(sessionId),
      ]);
      if (!session) return;

      const md = agentSessionToMarkdown(
        { title: session.title, projectPath: session.project_path, model: session.model, createdAt: session.created_at },
        messages,
      );
      const safeTitle = (session.title || 'agent-session').slice(0, 40).replace(/[\\/:*?"<>|]/g, '_');
      await api.file.export(md, `${safeTitle}.md`, 'md');
    } catch (err) {
      console.error('[Agent] 导出失败:', err);
    }
  },

  listSessions: async () => {
    try {
      const { cwd } = get();
      const summaries = await api.agent.listSessions(cwd || undefined);
      set({ sessionSummaries: summaries });
    } catch (err) {
      console.warn('[Agent] 列出会话失败:', err);
    }
  },

  setPendingMessage: (text) => {
    set({ pendingMessage: text });
  },
}));
