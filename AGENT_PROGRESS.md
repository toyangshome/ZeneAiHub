# Agent 模块开发进度

> 最后更新：2026-05-13
> 状态：Phase 1 MVP 已完成，持续修复中

---

## 已完成

### 核心架构（全部完成）

- **CLI 内置**：`@anthropic-ai/claude-code` v2.1.139 作为 npm 依赖，自带 227MB 原生二进制，无需用户全局安装
- **子进程管理**：`AgentService`（`electron/services/agent/AgentService.ts`）通过 spawn CLI 子进程，`--output-format stream-json --verbose --print` 模式
- **多轮对话**：每次 `sendMessage` 重新 spawn CLI，通过 `--resume <sessionId>` 恢复上下文
- **行缓冲解析**：处理 JSON 被 chunk 截断的情况，逐行解析 stdout
- **Windows 兼容**：`taskkill /T /F` 终止进程树

### 文件清单

| 文件 | 状态 |
|------|------|
| `shared/types/agent.ts` | ✅ AgentStreamEvent, AgentMessage, AgentContentBlock, AgentSessionConfig |
| `shared/types/ipc.ts` | ✅ AGENT_* IPC 通道常量 |
| `shared/types/electron.d.ts` | ✅ agent 命名空间类型声明 |
| `electron/services/agent/CliChecker.ts` | ✅ getBundledCliPath(), checkClaudeCli(), getCliVersion() |
| `electron/services/agent/AgentService.ts` | ✅ 子进程 spawn、行缓冲、会话管理 |
| `electron/ipc/agentHandlers.ts` | ✅ IPC handler 注册 |
| `electron/preload.ts` | ✅ agent 命名空间暴露 |
| `src/services/ipcBridge.ts` | ✅ api.agent 对象 |
| `src/stores/agentStore.ts` | ✅ Zustand 状态管理 + 流事件处理 |
| `src/pages/Agent/index.tsx` | ✅ Agent 主页面 |
| `src/pages/Agent/components/AgentSidebar.tsx` | ✅ 状态侧栏 |
| `src/pages/Agent/components/ProjectSelector.tsx` | ✅ 项目目录选择 |
| `src/pages/Agent/components/AgentMessageList.tsx` | ✅ 消息流渲染 |
| `src/pages/Agent/components/AgentInput.tsx` | ✅ Sender 组件输入框 |
| `src/pages/Agent/components/blocks/ThinkingBlock.tsx` | ✅ 折叠思考过程 |
| `src/pages/Agent/components/blocks/ToolUseBlock.tsx` | ✅ 工具调用展示 |
| `src/pages/Agent/components/blocks/ToolResultBlock.tsx` | ✅ 工具结果展示 |
| `src/pages/Agent/components/blocks/TextBlock.tsx` | ✅ 文本回复（复用 MarkdownRenderer） |
| `src/pages/Settings/ClaudeCodeSettings.tsx` | ✅ API Key / Base URL / Model 配置 |

### 路由和菜单

- `/agent` 路由已注册（`App.tsx`）
- 侧栏 `RobotOutlined` Agent 入口已添加（`AppLayout.tsx`）

---

## 已修复的 Bug

| Bug | 原因 | 修复 |
|-----|------|------|
| Bash 命令一直显示"执行中" | tool_result 追加到错误的 assistant 消息 | 通过 tool_use_id 精确匹配到包含 tool_use 的消息 |
| 第二条消息重复 key 警告 | CLI 在同一次调用中复用消息 ID | 智能合并：已存在的块跳过，新块追加 |
| 背景颜色透明 | 使用了不存在的 antd CSS 变量 | 改用 `theme.useToken()` 获取 token |
| Agent 页面卡顿数秒 | `execSync` 检测 227MB 二进制 | 拆分为 fast existsSync + 异步版本获取 |
| stderr 导致会话出错 | CLI 将进度信息输出到 stderr | 过滤已知噪声模式，不发送到前端 |
| 进程退出后状态卡住 | 缺少安全网 | close handler 发送 done 事件 + store 重置 |
| cancel 后会话泄漏 | 缺少 sessions.delete() | kill 后清理 Map |
| 输入框透明无边框 | 同 CSS 变量问题 | 使用 antd token |
| 输入框样式不统一 | 原生 Input.TextArea | 改用 @ant-design/x Sender 组件 |
| stdin 3s wait 警告 | stdio 全部 pipe | 改为 `['ignore', 'pipe', 'pipe']` |
| 只显示思考过程无结果 | 重复跳过逻辑过于激进 | 智能合并：保留已有 tool_result，添加新 text 块 |

---

## 关键设计决策

### 1. 一次性调用模式
每次 `sendMessage` 都 spawn 一个新的 CLI 进程（带 `--resume`），而非保持长连接。原因：
- CLI 的 `--print` 模式天然是一次性执行
- `--resume` 可以恢复上下文
- 避免 stdin 管道和长时间进程管理的复杂性

### 2. 环境变量注入 API Key
- `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL` 通过环境变量传给子进程
- `--model` 通过 CLI 参数传入
- 渲染进程不接触 Key，主进程从 electron-store 读取

### 3. 智能去重
同一次 CLI 调用可能多次发送同一消息 ID 的 assistant 事件（先 thinking+tool_use，后 text）。store 层通过消息 ID 检测重复，合并新出现的块，跳过已存在的。

### 4. tool_result 匹配
不盲目追加到最后一条 assistant 消息，而是通过 `tool_use_id` 精确匹配到包含对应 `tool_use` 的消息。

### 5. 主题适配
所有 Agent 组件使用 `theme.useToken()` 获取颜色，不使用 CSS 变量（antd v5 部分 token 不生成 CSS 变量）。

---

## 已修复：执行中信号不完成

**问题**：Agent 回复的多行命令"执行中"状态太多，且一直处于 Active 状态，未收到执行完毕的信号。

**根因**：
CLI 在 `--print` 模式下，一次 CLI 调用可能只发送一个大的 assistant 事件（包含所有 tool_use + text），而 tool_result 可能不完整或延迟到达。当前逻辑等待 tool_result 匹配来标记"已完成"，但如果 CLI 调用结束时还没有收到 tool_result，状态就永远卡在"执行中"。

**修复方案**（2026-05-13）：
- `result` 事件到达时：遍历所有 assistant 消息，找到没有匹配 tool_result 的 tool_use，添加合成的 `tool_result { content: '', is_error: false }` 标记为已完成
- `onStreamDone` 安全网同理：进程退出时如果 status 仍为 running，补全所有未完成的 tool_use

---

## 待开发（Phase 2）

| 功能 | 说明 | 优先级 |
|------|------|--------|
| 工具调用确认弹窗 | Bash/destructive 操作需用户确认 | 高 |
| 文件 diff 可视化 | 编辑文件前后对比 | 中 |
| 会话持久化 | 对话记录保存到 SQLite | 中 |
| 从 Chat 跳转到 Agent | 当前对话上下文传递 | 低 |
| 对话导出 | 导出为 Markdown | 低 |
| 多项目并行 | 同时管理多个项目会话 | 低 |

---

## 开发注意事项

1. **CLI 输出解析**：stdout 逐行 JSON，但可能被 chunk 截断，必须做行缓冲
2. **stderr 噪声**：CLI 将进度信息输出到 stderr，需过滤（Loaded local、Using、Authenticat 等）
3. **进程管理**：Windows 下用 `taskkill /T /F` 终止进程树，避免僵尸进程
4. **重复事件**：同一次 CLI 调用可能多次发送同一消息，必须做去重
5. **tool_result 时机**：tool_result 可能在 CLI 调用结束后才收到，也可能收不到
6. **antd 颜色**：使用 `theme.useToken()` 而非 CSS 变量，确保亮色/暗色主题一致
