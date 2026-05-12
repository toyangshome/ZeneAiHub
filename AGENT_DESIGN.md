# ZeneAIHub Agent 模块 — 功能分析与实现思路

> 日期：2026-05-12 | 状态：设计分析，供后续开发参考

---

## 1. Agent 是什么？与现有模块的关系

### 1.1 四层能力模型

```
Prompt ──→ Skill ──→ Chat（带工具）──→ Agent
 模板注入    一次执行    对话+工具调用    自主循环执行
```

| 模块 | 本质 | 生命周期 | 工具使用 | 自主性 |
|------|------|---------|---------|--------|
| **Prompt** | 文本模板 | 常驻（激活后持续生效） | 无 | 无 |
| **Skill** | 带参数的 prompt | 一次执行 | 无（MCP 已移除） | 无 |
| **Chat** | 对话 | 多轮持续 | 无（当前）或可扩展 | 无，用户驱动 |
| **Agent** | 自主任务执行器 | 任务级循环 | 有（文件/命令/Git） | 高，可自主决策 |

**核心区别**：Chat 是"用户说一句 AI 回一句"的对话模式；Agent 是"用户给一个任务，AI 自主规划、执行、反馈、迭代直到完成"。

### 1.2 为什么需要 Agent？

现有 Chat + Skill 模式解决不了的场景：
- **多步骤任务**："帮我重构这个模块，跑通测试，提交代码" — Chat 模式下需要用户手动引导每一步
- **工具调用**：AI 需要读文件、写文件、执行命令 — 当前 Chat 不支持
- **上下文感知**：Agent 以项目目录为工作区，理解整个代码库结构
- **自主迭代**：测试失败 → 自动修复 → 重跑，无需用户干预

---

## 2. 三种技术路线对比

### 路线 A：子进程包装 Claude Code CLI

```
ZeneAIHub ──spawn──→ claude CLI (stream-json) ──解析──→ UI
```

| 项目 | 说明 |
|------|------|
| 原理 | `child_process.spawn('claude', ['--output-format', 'stream-json'])` |
| 优势 | 零开发工具链、完整 CLI 能力、自动更新 |
| 劣势 | 强依赖 CLI 安装、UI 定制受限、只能用 Anthropic 模型 |
| 工作量 | ~20h（已有详细方案 CLAUDE_CODE_AGENT_PLAN.md） |
| 适合 | 快速 MVP，验证用户需求 |

### 路线 B：基于 Anthropic SDK 自建 Agent 循环

```
用户任务 → AgentLoop → LLM API (tool_use) → 执行工具 → 结果回注 → 循环
```

| 项目 | 说明 |
|------|------|
| 原理 | `@anthropic-ai/sdk` + `tool_use` + 自实现工具（Read/Write/Bash/Grep） |
| 优势 | 完全可控、UI 深度集成、可支持多模型 |
| 劣势 | 开发量大、需自行实现工具链和安全机制 |
| 工作量 | ~40-60h |
| 适合 | CLI 不满足需求时的长期方案 |

### 路线 C：混合方案（推荐）

先 A 后 B，用 A 验证需求，用 B 替换底层。

```
Phase 1: 包装 Claude Code CLI → 验证 Agent 交互模式和用户需求
Phase 2: 自建 Agent 循环 → 脱离 CLI 依赖，支持多模型
```

---

## 3. 核心设计决策

### 3.1 Agent 与 Chat 是同一个页面还是分开？

**推荐：分开。** 原因：
- 交互模式完全不同（对话 vs 任务面板）
- Agent 需要项目目录选择器、工具调用可视化、权限确认等独有 UI
- Agent 的消息结构比 Chat 复杂得多（thinking + tool_use + tool_result + text）
- 可以在 Chat 页面添加"切换到 Agent 模式"的入口

### 3.2 Agent 需要自己的数据存储吗？

**复用现有 conversations/messages 表，通过 metadata 区分。**

```sql
-- messages.metadata 中增加 agent 相关字段
{
  "agentMode": true,
  "toolCalls": [
    { "id": "xxx", "name": "read_file", "input": {...}, "result": "..." }
  ],
  "thinking": "模型思考过程..."
}
```

好处：Agent 对话和普通对话在同一列表中可见，统一管理。

### 3.3 工具执行的安全模型

| 操作 | 默认行为 | 可配置 |
|------|---------|--------|
| 读文件 | 自动批准 | — |
| 写/编辑文件 | 自动批准 | 可改为确认 |
| Bash 命令 | **需确认**（展示命令预览） | 可改为自动 |
| 删除文件 | **需确认** | — |
| Git commit | 自动批准 | — |
| Git push | **需确认** | — |
| 网络请求 | 自动批准 | 可改为确认 |

确认机制：主进程拦截工具调用 → 推送确认请求到渲染进程 → 用户批准/拒绝 → 主进程继续/取消。

### 3.4 工具定义标准化

无论用 CLI 包装还是自建 Agent，工具的输入输出应统一：

```typescript
interface ToolCall {
  id: string;           // 唯一标识
  name: string;         // 工具名: read_file, write_file, bash, grep, git
  input: Record<string, unknown>;  // 参数
  result?: ToolResult;  // 执行结果
  status: 'pending' | 'running' | 'done' | 'error' | 'denied';
}

interface ToolResult {
  content: string;      // 文本结果
  isError: boolean;
  metadata?: {
    filePath?: string;  // 文件路径（用于 diff 展示）
    linesChanged?: number;
    exitCode?: number;  // 命令退出码
  };
}
```

---

## 4. 实现架构（路线 A + C 视角）

### 4.1 进程拓扑

```
渲染进程                     主进程                      子进程
┌────────────┐  IPC   ┌──────────────┐  spawn  ┌──────────────┐
│ AgentPage  │◄──────►│ AgentService  │────────►│ claude CLI   │
│ └─消息列表  │ events │ └─会话管理    │  stdout │ └─文件操作    │
│ └─工具展示  │◄───────│ └─事件解析    │◄────────│ └─Bash执行    │
│ └─确认弹窗  │───────►│ └─权限控制    │  stdin  │ └─Git操作     │
│ └─输入框    │  send  │              │────────►│ └─搜索        │
└────────────┘        └──────────────┘         └──────────────┘
```

### 4.2 关键文件清单

```
electron/
  services/
    agent/
      AgentService.ts          # CLI 子进程生命周期管理
      ToolInterceptor.ts       # 拦截工具调用，执行权限检查
      StreamParser.ts          # 解析 stream-json 输出
  ipc/
    agentHandlers.ts           # agent:* IPC 通道

shared/
  types/
    agent.ts                   # AgentSession, AgentMessage, ToolCall 等类型

src/
  pages/
    Agent/
      index.tsx                # Agent 主页面
      components/
        AgentSidebar.tsx       # 项目/会话列表
        ProjectSelector.tsx    # 项目目录选择
        AgentMessageList.tsx   # 消息流（thinking + tool + text）
        AgentInput.tsx         # 指令输入
        ToolCallCard.tsx       # 工具调用卡片（可展开查看详情）
        ToolConfirmModal.tsx   # 工具执行确认弹窗
        DiffViewer.tsx         # 文件 diff 对比
  stores/
    agentStore.ts              # Agent 状态管理
```

### 4.3 Agent 页面 UI 布局

```
┌─ Sidebar ─┬─ Main Content ──────────────────────────┐
│           │  [项目路径]              [停止] [清空]    │
│ 会话 1     │  ─────────────────────────────────────   │
│ 会话 2     │                                          │
│ 会话 3     │   请帮我重构 src/auth 模块               │
│            │                                          │
│ + 新会话    │   Thinking: 用户想要重构认证模块...      │
│            │   ┌─────────────────────────────────┐   │
│            │   │ read src/auth/login.ts          │   │
│            │   │ 42 lines                        │   │
│            │   └─────────────────────────────────┘   │
│            │   ┌─────────────────────────────────┐   │
│            │   │ edit src/auth/login.ts          │   │
│            │   │ +15 lines, -8 lines             │   │
│            │   │ [查看 diff]                      │   │
│            │   └─────────────────────────────────┘   │
│            │   ┌─────────────────────────────────┐   │
│            │   │ bash: npm test                  │   │
│            │   │ ✓ 3 passing                     │   │
│            │   └─────────────────────────────────┘   │
│            │                                          │
│            │   已完成认证模块重构，修改了 3 个文件。   │
│            │                                          │
│            │  ─────────────────────────────────────   │
│            │  [ 输入下一步指令...          ] [发送]   │
└────────────┴──────────────────────────────────────────┘
```

---

## 5. 与现有系统的集成点

### 5.1 模型配置复用
- Agent 使用 ZeneAIHub 已配置的 Anthropic API Key
- 主进程从 electron-store 读取，通过环境变量传给 CLI 子进程
- 渲染进程不接触 Key

### 5.2 导航与路由
- 侧栏新增 `Agent` 入口（RobotOutlined 图标）
- 路由 `/agent`
- 与 Chat/Prompts/Skills/Settings 并列

### 5.3 数据库
- 复用 `conversations` + `messages` 表
- `messages.metadata` 扩展存储 tool_calls 和 thinking
- Agent 会话在侧栏对话列表中可见，带特殊标记

### 5.4 从 Chat 切换到 Agent
- 在 Chat 页面添加"用 Agent 执行"按钮
- 当前对话上下文传递到 Agent 会话（可选）

---

## 6. 实施阶段建议

### Phase 1：MVP（子进程包装，~20h）

基于现有 `CLAUDE_CODE_AGENT_PLAN.md`，核心功能：
- AgentService（CLI 子进程管理）
- Agent 页面（消息流 + 工具调用展示）
- 项目目录选择器
- 基础权限控制（Bash 确认）
- CLI 可用性检测 + 安装引导

### Phase 2：体验增强（~15h）
- 文件 diff 可视化
- 工具调用确认弹窗（精细化权限控制）
- 会话持久化到 SQLite
- 从 Chat 跳转到 Agent 的入口
- Agent 对话导出

### Phase 3：脱离 CLI（~40h，按需）
- 基于 `@anthropic-ai/sdk` 自建 Agent 循环
- 自实现工具链（Read/Write/Bash/Grep/Git）
- 支持多模型（不限于 Anthropic）
- 工具结果缓存和上下文管理

---

## 7. 风险与注意事项

| 风险 | 应对 |
|------|------|
| CLI 未安装导致功能不可用 | 启动时检测 + 引导安装页 |
| CLI stream-json 格式变化 | 版本检测 + 兼容层 + 降级文本展示 |
| 僵尸子进程 | 超时机制 + 应用退出时 kill 所有子进程 |
| 工具调用安全（rm -rf 等） | Bash 默认需确认 + 危险命令黑名单 |
| 大文件输出导致内存压力 | 限制 buffer 大小 + 截断展示 |
| API Key 泄露 | 环境变量传递，不暴露到渲染进程 |

---

## 8. 总结

Agent 是 ZeneAIHub 中最高阶的能力模块，位于 Prompt → Skill → Chat → Agent 链条的顶端。

**核心价值**：让 AI 从"回答问题"进化到"完成任务"。

**推荐路径**：先用子进程包装 Claude Code CLI 快速交付 MVP，验证用户需求后再决定是否自建 Agent 循环。Phase 1 的 20h 投入是合理的验证成本。

**与移除 MCP 的关系**：Agent 内置的工具（文件/Bash/Git/搜索）比 MCP 更实用且无外部依赖。MCP 的工具调用能力被 Agent 覆盖，移除 MCP 是正确的决策。
