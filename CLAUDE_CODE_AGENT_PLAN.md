# ZeneAIHub 内置 Claude Code Agent 方案

> 版本：v1.0 | 日期：2026-05-09 | 状态：规划中

---

## 1. 目标

在 ZeneAIHub 中内置 **Claude Code Agent**，让用户无需打开终端，直接在桌面应用中完成 AI 编程任务：

- 在选定的项目目录中执行编程任务（代码生成、重构、调试、测试等）
- 流式展示 Agent 的思考过程和工具调用（读写文件、执行命令、Git 操作）
- 支持会话式交互：多轮对话、任务中断、上下文延续
- 与 ZeneAIHub 现有的对话系统共享模型配置

---

## 2. 技术方案对比

| 方案 | 实现方式 | 优势 | 劣势 |
|------|---------|------|------|
| **A. 子进程包装** | `child_process.spawn('claude', [...])` | 零开发工具链、完整 CLI 能力、自动更新 | 依赖 CLI 安装、UI 定制受限 |
| **B. Agent SDK 集成** | `@anthropic-ai/agent-sdk` | 原生深度集成、UI 完全可控、无外部依赖 | SDK 尚未公开发布、需自行实现工具链 |
| **C. API + 自建 Agent** | `@anthropic-ai/sdk` + 自定义工具 | 灵活度最高、完全可控 | 开发量大、需实现文件/命令/Git 工具 |

### 推荐：方案 A（子进程包装）作为首版实现

**理由：**
1. Claude Code CLI 已经是成熟的 Agent 产品，包含完整的工具链（文件操作、Bash、Git、搜索等）
2. 通过 `--output-format stream-json` 获取结构化流式输出，解析后渲染到 UI
3. 开发量最小，可以快速交付 MVP
4. 后续可平滑迁移到方案 B/C

---

## 3. 架构设计

### 3.1 进程拓扑

```
┌─────────────────────────────────────────────┐
│  Electron 渲染进程（React UI）               │
│  ┌─────────────────────────────────────────┐│
│  │  AgentChatPage                          ││
│  │  ├── ProjectSelector  (选择工作目录)     ││
│  │  ├── AgentMessageList (流式消息展示)     ││
│  │  │   ├── ThinkingBlock  (思考过程)      ││
│  │   │   ├── ToolUseBlock   (工具调用)     ││
│  │  │   ├── ToolResultBlock (工具结果)     ││
│  │  │   └── TextBlock       (文本回复)     ││
│  │  └── AgentInput       (指令输入)        ││
│  └─────────────────────────────────────────┘│
│                    ▲                         │
│                    │ IPC (流式事件)           │
│                    ▼                         │
│  Electron 主进程                              │
│  ┌─────────────────────────────────────────┐│
│  │  AgentService                           ││
│  │  ├── spawn Claude Code CLI 子进程       ││
│  │  ├── 解析 stream-json 输出             ││
│  │  └── 管理会话生命周期                   ││
│  └─────────────────────────────────────────┘│
│                    │                         │
│                    ▼                         │
│  Claude Code CLI (子进程)                     │
│  ┌─────────────────────────────────────────┐│
│  │  claude --output-format stream-json     ││
│  │  ├── 文件读写 (Read/Edit/Write)         ││
│  │  ├── Bash 命令执行                      ││
│  │  ├── Git 操作                           ││
│  │  ├── 搜索 (Grep/Glob)                  ││
│  │  └── Web 搜索/Fetch                    ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 3.2 数据流

```
用户输入 → 渲染进程 → IPC → 主进程 → spawn claude CLI
                                        │
                                        ▼
                              stdout (stream-json)
                                        │
                              主进程解析 JSON 事件
                                        │
                              IPC 事件推送到渲染进程
                                        │
                              渲染进程增量渲染 UI
```

---

## 4. 详细实现

### 4.1 主进程：AgentService

**文件：** `electron/services/agent/AgentService.ts`

```typescript
interface AgentSession {
  id: string;              // 会话唯一 ID
  projectDir: string;      // 工作目录
  process: ChildProcess;   // CLI 子进程
  status: 'idle' | 'running' | 'waiting_input' | 'error' | 'done';
}

class AgentService {
  private sessions: Map<string, AgentSession> = new Map();

  /**
   * 创建新会话或恢复已有会话
   */
  startSession(sessionId: string, projectDir: string, sender: WebContents): void;

  /**
   * 向会话发送用户消息
   */
  sendMessage(sessionId: string, content: string): void;

  /**
   * 中断正在执行的任务
   */
  cancelSession(sessionId: string): void;

  /**
   * 销毁会话，清理子进程
   */
  destroySession(sessionId: string): void;
}
```

**关键实现：启动 Claude Code CLI**

```typescript
function startSession(sessionId, projectDir, sender) {
  const proc = spawn('claude', [
    '--output-format', 'stream-json',
    '--verbose',               // 包含工具调用详情
  ], {
    cwd: projectDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // 从 ZeneAIHub 模型配置中获取 API Key
      ANTHROPIC_API_KEY: getApiKey('anthropic'),
    },
  });

  // 解析 stdout 中的 JSON 行
  let buffer = '';
  proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        sender.send(`agent:event:${sessionId}`, event);
      } catch {
        // 非 JSON 行（CLI 提示信息等）
        sender.send(`agent:raw:${sessionId}`, line);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    sender.send(`agent:error:${sessionId}`, data.toString());
  });

  proc.on('close', (code) => {
    sender.send(`agent:done:${sessionId}`, code);
    this.sessions.delete(sessionId);
  });

  this.sessions.set(sessionId, { id: sessionId, projectDir, process: proc, status: 'running' });
}
```

### 4.2 IPC 通道

**文件：** `electron/ipc/agentHandlers.ts`

| 通道名 | 方向 | 参数 | 说明 |
|--------|------|------|------|
| `agent:start` | 渲染→主 | `{ sessionId, projectDir }` | 启动 Agent 会话 |
| `agent:send` | 渲染→主 | `{ sessionId, content }` | 发送用户消息 |
| `agent:cancel` | 渲染→主 | `{ sessionId }` | 中断当前任务 |
| `agent:destroy` | 渲染→主 | `{ sessionId }` | 销毁会话 |
| `agent:event:${sessionId}` | 主→渲染 | `AgentStreamEvent` | 流式事件推送 |
| `agent:done:${sessionId}` | 主→渲染 | `exitCode` | 会话结束 |
| `agent:error:${sessionId}` | 主→渲染 | `errorText` | 错误信息 |

### 4.3 流式事件类型

Claude Code CLI 输出的 `stream-json` 事件格式（需根据实际 CLI 输出调整）：

```typescript
type AgentStreamEvent =
  | { type: 'message_start'; role: 'assistant' }
  | { type: 'content_block_start'; block: ContentBlock }
  | { type: 'content_block_delta'; delta: { text?: string; partial_json?: string } }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_stop' }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: 'thinking'; content: string }  // 思考链
  | { type: 'error'; message: string };
```

### 4.4 渲染进程：IPC Bridge 扩展

**文件：** `src/services/ipcBridge.ts`（扩展 api 对象）

```typescript
export const api = {
  // ... 现有代码 ...

  agent: {
    start: (sessionId: string, projectDir: string) =>
      window.electronAPI.agent.start(sessionId, projectDir),
    send: (sessionId: string, content: string) =>
      window.electronAPI.agent.send(sessionId, content),
    cancel: (sessionId: string) =>
      window.electronAPI.agent.cancel(sessionId),
    destroy: (sessionId: string) =>
      window.electronAPI.agent.destroy(sessionId),
    onEvent: (sessionId: string, cb: (event: AgentStreamEvent) => void) => {
      const channel = `agent:event:${sessionId}`;
      const handler = (_e: any, data: AgentStreamEvent) => cb(data);
      window.electronAPI._on(channel, handler);
      return () => window.electronAPI._off(channel, handler);
    },
    onDone: (sessionId: string, cb: (code: number) => void) => { /* ... */ },
    onError: (sessionId: string, cb: (err: string) => void) => { /* ... */ },
  },
};
```

需要在 `preload.ts` 中增加对应的 `agent` API 暴露。

### 4.5 渲染进程：Agent Chat 页面

**文件结构：**

```
src/pages/Agent/
├── index.tsx                    # Agent 页面主入口
├── components/
│   ├── AgentSidebar.tsx         # 会话历史侧栏
│   ├── ProjectSelector.tsx      # 项目目录选择器
│   ├── AgentMessageList.tsx     # 消息列表（流式）
│   ├── AgentInput.tsx           # 指令输入框
│   └── blocks/
│       ├── ThinkingBlock.tsx    # 思考过程展示（可折叠）
│       ├── ToolUseBlock.tsx     # 工具调用展示
│       │   ├── FileReadTool.tsx     # 读文件
│       │   ├── FileEditTool.tsx     # 编辑文件
│       │   ├── BashTool.tsx         # 执行命令
│       │   ├── GitTool.tsx          # Git 操作
│       │   └── SearchTool.tsx       # 搜索
│       ├── ToolResultBlock.tsx  # 工具执行结果
│       └── TextBlock.tsx        # 普通文本
├── hooks/
│   └── useAgentSession.ts      # Agent 会话管理 hook
└── stores/
    └── agentStore.ts           # Agent 状态管理
```

**useAgentSession hook 核心逻辑：**

```typescript
function useAgentSession(sessionId: string, projectDir: string) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'waiting_input' | 'error'>('idle');

  const start = useCallback(() => {
    api.agent.start(sessionId, projectDir);

    const removeEvent = api.agent.onEvent(sessionId, (event) => {
      setMessages((prev) => mergeEvent(prev, event));
    });
    const removeDone = api.agent.onDone(sessionId, (code) => {
      setStatus(code === 0 ? 'idle' : 'error');
    });
    const removeError = api.agent.onError(sessionId, (err) => {
      // 处理错误
    });

    return () => { removeEvent(); removeDone(); removeError(); };
  }, [sessionId, projectDir]);

  const send = useCallback((content: string) => {
    setStatus('running');
    api.agent.send(sessionId, content);
  }, [sessionId]);

  const cancel = useCallback(() => {
    api.agent.cancel(sessionId);
    setStatus('idle');
  }, [sessionId]);

  return { messages, status, start, send, cancel };
}
```

**UI 组件示意（Agent 页面布局）：**

```
┌──────────────────────────────────────────────────────┐
│  ▶ /project/path/to/repo        [切换项目]   [停止]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│    Thinking: 用户想要我添加一个登录功能...            │
│    ┌──────────────────────────────────────────┐      │
│    │  read src/auth/login.ts                  │      │
│    │  +42 lines, -3 lines                     │      │
│    └──────────────────────────────────────────┘      │
│                                                      │
│    我已经为登录功能添加了 JWT token 验证逻辑。        │
│    修改了以下文件：                                   │
│    - src/auth/login.ts                               │
│    - src/routes/auth.ts                              │
│                                                      │
│    ┌──────────────────────────────────────────┐      │
│    │  $ npm test -- --grep "login"            │      │
│    │  ✓ should validate credentials (42ms)    │      │
│    │  3 passing                               │      │
│    └──────────────────────────────────────────┘      │
│                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  [ 输入你的下一个任务...                    ] [发送]  │
└──────────────────────────────────────────────────────┘
```

### 4.6 Zustand Store

**文件：** `src/stores/agentStore.ts`

```typescript
interface AgentState {
  sessions: AgentSessionSummary[];
  currentSessionId: string;
  projectDir: string;

  loadSessions: () => Promise<void>;
  createSession: (projectDir: string) => string;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
  setProjectDir: (dir: string) => void;
}
```

---

## 5. 与 ZeneAIHub 现有系统的集成

### 5.1 模型配置复用

Agent 使用 ZeneAIHub 已配置的 Anthropic 模型 API Key。主进程从 `SecureStore` 中读取 `apikey:<modelId>`，设置为子进程的 `ANTHROPIC_API_KEY` 环境变量。

```typescript
// AgentService.startSession 中
const apiKey = secureStore.get('apikey:<anthropic-model-id>');
proc = spawn('claude', [...], {
  env: { ...process.env, ANTHROPIC_API_KEY: apiKey },
});
```

### 5.2 路由注册

在 `src/routes.tsx` 中添加 `/agent` 路由，侧栏菜单增加"Agent"入口。

### 5.3 数据库存储

Agent 对话记录复用现有 `conversations` / `messages` 表，通过 `metadata.agentMode: true` 标识区分普通对话和 Agent 会话。

### 5.4 主题复用

Agent 页面组件使用 antd 主题系统，自动跟随亮色/暗色主题切换。

---

## 6. 安全与权限

### 6.1 用户确认机制

Agent 的破坏性操作需要用户确认：

| 操作类型 | 确认方式 |
|---------|---------|
| 写入/编辑文件 | 自动批准（用户可在设置中关闭） |
| 执行 shell 命令 | 弹窗确认 + 命令预览 |
| 删除文件 | 弹窗确认 + 文件路径展示 |
| Git push/force-push | 弹窗确认 + 分支信息展示 |
| 访问网络 | 自动批准（可配置） |

### 6.2 目录隔离

- Agent 只能在用户选定的项目目录内操作
- 工作目录通过 `cwd` 参数限制
- 可选：通过操作系统级沙箱进一步隔离

### 6.3 API Key 安全

- API Key 通过环境变量传递给 CLI 子进程，不暴露到渲染进程
- 渲染进程只看到模型名称，不接触 Key 本身
- 复用现有 `SecureStore` 的加密存储

---

## 7. 实施步骤

### Phase 1：核心功能（MVP）

| 步骤 | 任务 | 预估工时 |
|------|------|---------|
| 1 | 安装 `claude` CLI 依赖检查 | 0.5h |
| 2 | 实现 `AgentService`（主进程） | 4h |
| 3 | 实现 IPC handlers + preload 暴露 | 2h |
| 4 | 实现 `agentStore.ts` | 1h |
| 5 | 实现 `useAgentSession` hook | 2h |
| 6 | 实现 Agent 页面 + 消息渲染 | 6h |
| 7 | 实现项目目录选择器 | 1h |
| 8 | 路由注册 + 侧栏入口 | 1h |
| 9 | 集成测试 + 修复 | 3h |

**总计：约 20 小时**

### Phase 2：增强功能

| 功能 | 说明 |
|------|------|
| 工具调用确认机制 | shell 命令/destructive 操作需用户确认 |
| 文件 diff 可视化 | 编辑文件前后 diff 对比 |
| 会话持久化 | Agent 对话记录保存到 SQLite |
| 多项目并行 | 同时管理多个项目的 Agent 会话 |
| 自定义系统提示词 | 用户可配置 Agent 的行为指令 |

### Phase 3：高级功能

| 功能 | 说明 |
|------|------|
| MCP 工具集成 | 将 ZeneAIHub MCP 管理的工具注入 Agent |
| 模型切换 | 支持在 Agent 会话中切换 Claude 模型 |
| 导出/分享 | 导出 Agent 对话为 Markdown |
| 快捷键 | 全局快捷键唤起 Agent 面板 |

---

## 8. CLI 依赖检查

应用启动时检测 `claude` CLI 是否可用：

```typescript
// electron/services/agent/CliChecker.ts
function checkClaudeCli(): Promise<{ available: boolean; version?: string; path?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--version'], { stdio: 'pipe' });
    let output = '';
    proc.stdout.on('data', (d) => { output += d; });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ available: true, version: output.trim() });
      } else {
        resolve({ available: false });
      }
    });
    proc.on('error', () => {
      resolve({ available: false });
    });
  });
}
```

如果 CLI 未安装，在 Agent 页面展示引导提示：
- 提供安装命令：`npm install -g @anthropic-ai/claude-code`
- 或提供下载链接

---

## 9. 技术风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| CLI 版本更新导致 stream-json 格式变化 | UI 解析失败 | 版本检测 + 兼容层，降级为纯文本展示 |
| CLI 进程未正常退出（僵尸进程） | 资源泄漏 | 定时清理 + 进程超时机制 |
| 子进程 stdout 输出过大导致内存压力 | 渲染卡顿 | 限制缓冲区大小，及时推送到 UI |
| 用户未安装 CLI | 功能不可用 | 引导安装 + 内置安装提示 |
| API Key 配置错误 | Agent 无法启动 | 预检查 + 友好错误提示 |

---

## 10. 后续演进路径

```
Phase 1 (子进程包装)
  ↓ 验证用户需求和交互模式
Phase 2 (Agent SDK 集成，如 SDK 公开发布)
  ↓ 更深度的 UI 集成
Phase 3 (自建 Agent + MCP 工具链)
  ↓ 完全自主可控
```

子进程方案是最低成本的验证方式。如果用户反馈积极且需要更深度定制（如实时文件预览、交互式确认等），再迁移到 Agent SDK 或自建 Agent。
