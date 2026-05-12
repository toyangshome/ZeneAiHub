# ZeneAIHub - 架构设计文档

> Electron + React 桌面端 AI 工具平台
> 最后更新：2026-05-09（v3 — 集成 Ant Design X + 最终 Review 修正）

---

## 一、项目概述

### 1.1 定位

ZeneAIHub 是一个基于 Electron 的桌面端 AI 工具平台，集成多模型对话、Prompt 模板、Skill/MCP 管理等功能，为用户提供一站式的 AI 交互体验。

### 1.2 核心特性

| 功能模块 | 说明 |
|---------|------|
| AI 对话/聊天 | 多轮对话、流式输出、对话历史、多会话管理 |
| 模型管理/配置 | 多模型接入（OpenAI/Claude/本地模型）、API Key 管理、参数调优 |
| 文件处理 | 文件上传、拖拽、AI 文件解析、导出对话 |
| Prompt 模板库 | 模板 CRUD、分类管理、变量插值、导入导出 |
| Skill 管理 | 技能注册、配置、调用链路、执行结果展示 |
| MCP 管理 | MCP Server 连接、工具列表、调用测试、配置管理 |
| Claude Code Agent | 内置 AI 编程 Agent，子进程包装 Claude Code CLI，流式展示工具调用与文件操作 |

### 1.3 非功能性需求

| 需求 | 目标 |
|------|------|
| 启动时间 | 冷启动 < 3 秒 |
| 内存占用 | 空闲状态 < 300MB |
| 对话响应 | 首 token 延迟 < 2 秒（取决于模型 API） |
| 离线能力 | 历史对话/Prompt 模板可离线查看 |
| 跨平台 | Windows / macOS / Linux |
| 数据安全 | API Key 永不暴露到渲染进程，对话数据本地加密可选 |

---

## 二、技术栈

### 2.1 核心框架

| 层级 | 技术选型 | 版本 | 理由 |
|------|---------|------|------|
| 桌面壳 | Electron | 34+ | 成熟稳定，Chromium 内核，跨平台 |
| 前端框架 | React | 19+ | 生态丰富，Hooks 开发体验好 |
| 语言 | TypeScript | 5.7+ | 类型安全，大型项目必备 |
| 构建工具 | Vite | 6+ | 极速 HMR，原生 ESM |
| 包管理 | pnpm | 10+ | 快速、节省磁盘空间、monorepo 友好 |

### 2.2 UI 与样式

| 技术 | 版本 | 用途 |
|------|------|------|
| Ant Design | 5.x | 主组件库，通用 UI（表单、表格、布局、弹窗等） |
| Ant Design X | 1.x | AI 专用组件库（对话气泡、输入框、会话列表、推理链等） |
| Ant Design Icons | 5.x | 图标库 |
| Tailwind CSS | 4.x | 辅助样式，快速布局和微调 |

> **Ant Design X** 是 Ant Design 官方团队推出的 AI 交互组件库，与 antd 5.x 共享主题系统
> 和设计规范，可无缝混用。它解决了从零搭建 AI 对话 UI 的痛点（消息气泡、流式渲染、
> 会话管理、附件上传等），是我们选择 Ant Design 体系的重要加分项。
>
> **注意**：Ant Design / X 和 Tailwind 存在样式冲突风险。
> 解决方案：Tailwind 禁用 `preflight`，且仅在 Antd 组件之外的自定义区域使用 Tailwind。

### 2.3 状态管理与数据流

| 技术 | 用途 |
|------|------|
| Zustand | 全局状态管理（轻量、简洁、无样板代码） |
| React Context | 轻量级局部状态（主题、语言等） |

> **决策**：移除 TanStack Query。本项目是纯本地应用，数据来源为 IPC 而非 HTTP，
> TanStack Query 的缓存/重试/后台刷新机制在此场景无用武之地，反而增加复杂度。
> Zustand + IPC 封装层足以覆盖所有数据流需求。

### 2.4 通信与存储

| 技术 | 用途 |
|------|------|
| Electron IPC | 主进程 ↔ 渲染进程通信（ipcMain.handle + webContents.send） |
| electron-store | 本地配置持久化 |
| better-sqlite3 | 本地数据库（对话历史、模板等） |
| electron-updater | 应用自动更新 |

### 2.5 开发工具

| 工具 | 用途 |
|------|------|
| ESLint + Prettier | 代码规范 |
| Husky + lint-staged | Git 钩子 |
| Electron Builder | 应用打包 |
| Vitest | 单元测试 |
| Playwright (electron) | E2E 测试 |

---

## 三、架构设计

### 3.1 整体架构

```
┌───────────────────────────────────────────────────────────────┐
│                     Electron Main Process                      │
│                                                                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌────────┐ │
│  │ App 生命周期  │  │ Window Manager│  │ Tray/Menu│  │Updater │ │
│  └─────────────┘  └──────────────┘  └──────────┘  └────────┘ │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Services Layer                        │  │
│  │                                                         │  │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────────────┐ │  │
│  │  │ AI Service  │  │ File Service│  │ Storage Service   │ │  │
│  │  │ ┌────────┐ │  └────────────┘  │ ┌───────────────┐ │ │  │
│  │  │ │Provider│ │                  │ │ ConfigStore   │ │ │  │
│  │  │ │Registry│ │  ┌────────────┐  │ │ (electron-    │ │ │  │
│  │  │ └────────┘ │  │MCP Client  │  │ │  store)       │ │ │  │
│  │  │ ┌────────┐ │  └────────────┘  │ ├───────────────┤ │ │  │
│  │  │ │OpenAI  │ │                  │ │ Database      │ │ │  │
│  │  │ │Claude  │ │  ┌────────────┐  │ │ (better-      │ │ │  │
│  │  │ │Ollama  │ │  │Skill Svc   │  │ │  sqlite3)     │ │ │  │
│  │  │ │Custom  │ │  └────────────┘  │ ├───────────────┤ │ │  │
│  │  │ └────────┘ │                  │ │ SecureStore   │ │ │  │
│  │  └────────────┘  ┌────────────┐  │ │ (safeStorage) │ │ │  │
│  │                  │Log Service │  │ └───────────────┘ │ │  │
│  │                  └────────────┘  └───────────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   IPC Handlers Layer                     │  │
│  │  ipcMain.handle() ← 请求/响应                            │  │
│  │  webContents.send() → 主动推送（流式 chunk、事件通知）     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
├───────────────────────────────────────────────────────────────┤
│                    IPC Bridge (preload.ts)                     │
│                                                                │
│  contextBridge.exposeInMainWorld('electronAPI', { ... })      │
│  白名单制：仅暴露声明的 IPC 通道，不允许任意 Node.js 访问        │
│                                                                │
├───────────────────────────────────────────────────────────────┤
│                     React Renderer Process                     │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   Provider Layer                         │  │
│  │  BrowserRouter │ ConfigProvider(antd) │ ErrorBoundary   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                     Layout Layer                         │  │
│  │  ┌──────────┐  ┌──────────────────────────────────────┐ │  │
│  │  │  Sidebar  │  │            Content Area              │ │  │
│  │  │ (Antd     │  │  (React Router <Outlet />)           │ │  │
│  │  │  Layout   │  │                                      │ │  │
│  │  │  .Sider)  │  │                                      │ │  │
│  │  └──────────┘  └──────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Pages (路由级)                         │  │
│  │  Chat │ Models │ Files │ Prompts │ Skills │ MCP │ Settings│ │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Stores (Zustand)                      │  │
│  │  chatStore │ modelStore │ promptStore │ mcpStore │ uiStore │ │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 进程职责划分

**主进程 (Main Process)**

| 职责 | 说明 |
|------|------|
| 应用生命周期 | 窗口创建/管理、托盘、系统菜单、快捷键注册 |
| AI API 调用 | 避免 CORS 限制，保护 API Key，处理流式响应 |
| 文件系统操作 | 文件读写、对话导出、附件管理 |
| 数据库访问 | SQLite CRUD、数据迁移 |
| MCP Server 管理 | stdio 进程管理、SSE 连接、工具调用 |
| 安全存储 | API Key 加密存储（safeStorage）、配置管理 |
| 日志服务 | 统一日志收集、错误上报、日志文件滚动 |
| 自动更新 | electron-updater 检查与下载更新 |

**渲染进程 (Renderer Process)**

| 职责 | 说明 |
|------|------|
| UI 渲染与交互 | React 组件树、动画、用户输入 |
| 路由导航 | 页面切换、URL 状态 |
| 本地状态管理 | Zustand store 管理 UI 状态 |
| 消息格式化 | Markdown 渲染、代码高亮、图表渲染 |

**预加载脚本 (Preload)**

| 职责 | 说明 |
|------|------|
| API 白名单暴露 | 通过 contextBridge 安全暴露 IPC 通道 |
| 类型桥接 | 确保渲染进程获得类型安全的调用接口 |

### 3.3 安全模型

```
渲染进程                          preload.ts                       主进程
   │                                  │                              │
   │  window.electronAPI.ai.chat()    │                              │
   │─────────────────────────────────>│                              │
   │                                  │  ipcRenderer.invoke(         │
   │                                  │    'ai:chat', messages, cfg  │
   │                                  │  )                           │
   │                                  │─────────────────────────────>│
   │                                  │                              │  AIService.chat()
   │                                  │                              │  (API Key 从 SecureStore 取)
   │                                  │                              │
   │                                  │  result                      │
   │                                  │<─────────────────────────────│
   │  Promise<result>                 │                              │
   │<─────────────────────────────────│                              │
```

**流式通信模型：**

```
渲染进程                          主进程
   │                                │
   │  onStreamChunk(reqId, cb)      │  ← 注册事件监听
   │───────────────────────────────>│
   │                                │
   │  ai:stream:chunk:{reqId}       │  ← 主进程逐块推送
   │<───────────────────────────────│
   │  ai:stream:chunk:{reqId}       │
   │<───────────────────────────────│
   │  ai:stream:done:{reqId}        │  ← 流结束信号
   │<───────────────────────────────│
   │                                │
   │  cleanup() 移除所有监听         │ ← 移除监听，防内存泄漏
   │                                │
```

**关键安全原则：**
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`（Electron 34 默认）
- 所有 Node.js 操作走主进程 IPC
- API Key 仅存储在主进程侧，渲染进程只看到脱敏值（`sk-****xyz`）
- IPC 通道白名单制，不暴露原始 `ipcRenderer`
- 禁用 `webSecurity: false`，不开放任意文件访问
- 对外链接统一通过 `shell.openExternal` 打开，防止 XSS 钓鱼

**安全红线 — 禁止暴露的接口：**
```typescript
// ❌ 永远不能暴露给渲染进程
- db.query(sql, params)      // SQL 注入风险
- file.write(path, content)  // 任意文件写入
- child_process              // 命令执行
- fs                         // 文件系统直接访问
- process                    // 进程信息泄露

// ✅ 应当暴露的接口（白名单制）
- db.conversations.list()    // 预定义查询
- db.conversations.save(conv)// 预定义写入
- file.export(path, format)  // 受限导出
- file.selectDialog()        // 文件选择对话框
```

---

## 四、IPC 通信设计

### 4.1 通信模式

本项目使用三种 IPC 通信模式：

| 模式 | 方向 | API | 用途 |
|------|------|-----|------|
| 请求-响应 | 渲染→主 | `ipcMain.handle` + `ipcRenderer.invoke` | 查询、保存、操作 |
| 事件推送 | 主→渲染 | `webContents.send` + `ipcRenderer.on` | 流式输出、状态变更通知 |
| 双向订阅 | 双向 | 组合以上两种 | 流式对话、进度汇报 |

### 4.2 流式对话详细实现

流式对话不能使用回调函数传递（IPC 不支持函数序列化），必须使用事件机制：

```typescript
// ===== preload.ts =====
const electronAPI = {
  ai: {
    // 开始流式对话，返回 requestId
    startStream(requestId: string, messages: Message[], config: StreamConfig): Promise<void>;

    // 取消正在进行的流
    cancelStream(requestId: string): void;

    // 监听流式数据（渲染进程注册/注销）
    onStreamChunk(requestId: string, callback: (chunk: string) => void): () => void;
    onStreamDone(requestId: string, callback: () => void): () => void;
    onStreamError(requestId: string, callback: (error: string) => void): () => void;
  },
};
```

```typescript
// ===== 主进程 =====
ipcMain.handle('ai:start-stream', async (event, requestId, messages, config) => {
  const provider = providerRegistry.get(config.provider);
  try {
    for await (const chunk of provider.streamChat(messages, config)) {
      event.sender.send(`ai:stream:chunk:${requestId}`, chunk);
    }
    event.sender.send(`ai:stream:done:${requestId}`);
  } catch (error) {
    event.sender.send(`ai:stream:error:${requestId}`, error.message);
  }
});
```

```typescript
// ===== 渲染进程 Hooks =====
function useStreaming() {
  const [streaming, setStreaming] = useState(false);
  const [content, setContent] = useState('');

  const startStream = useCallback(async (messages, config) => {
    const requestId = crypto.randomUUID();
    setStreaming(true);
    setContent('');

    // 注册事件监听
    const removeChunk = window.electronAPI.ai.onStreamChunk(requestId, (chunk) => {
      setContent(prev => prev + chunk);
    });
    const removeDone = window.electronAPI.ai.onStreamDone(requestId, () => {
      setStreaming(false);
      cleanup();
    });
    const removeError = window.electronAPI.ai.onStreamError(requestId, (err) => {
      setStreaming(false);
      cleanup();
      // 处理错误
    });

    const cleanup = () => {
      removeChunk();
      removeDone();
      removeError();
    };

    // 启动流
    await window.electronAPI.ai.startStream(requestId, messages, config);
  }, []);

  return { streaming, content, startStream };
}
```

### 4.3 IPC 命名规范

```
{module}:{action}

示例：
- ai:stream:start        → 开始流式对话
- ai:stream:cancel       → 取消流式对话
- ai:stream:chunk:{id}   → 流式数据推送（事件）
- ai:stream:done:{id}    → 流结束（事件）
- ai:stream:error:{id}   → 流错误（事件）
- model:list             → 获取模型列表
- model:save             → 保存模型配置
- model:test             → 测试模型连接
- file:select            → 打开文件选择对话框
- file:export            → 导出文件
- db:conversation:list   → 获取对话列表
- db:conversation:save   → 保存对话
- db:conversation:delete → 删除对话
- mcp:server:connect     → 连接 MCP Server
- mcp:tool:call          → 调用 MCP 工具
- store:get              → 获取配置项
- store:set              → 设置配置项
- system:open-external   → 打开外部链接
- system:get-info        → 获取应用信息
```

### 4.4 核心 IPC API 定义

```typescript
// preload.ts 暴露的 API
interface ElectronAPI {
  // ===== AI =====
  ai: {
    startStream(requestId: string, messages: Message[], config: StreamConfig): Promise<void>;
    cancelStream(requestId: string): void;
    onStreamChunk(requestId: string, callback: (chunk: string) => void): () => void;
    onStreamDone(requestId: string, callback: () => void): () => void;
    onStreamError(requestId: string, callback: (error: string) => void): () => void;
    // 非流式调用（简单场景）
    chat(messages: Message[], config: ModelConfig): Promise<string>;
  };

  // ===== 模型 =====
  model: {
    list(): Promise<ModelConfigPublic[]>;     // 返回脱敏后的配置
    save(config: ModelConfigInput): Promise<void>;
    delete(id: string): Promise<void>;
    test(config: ModelConfigInput): Promise<{ success: boolean; latency: number; error?: string }>;
  };

  // ===== 文件 =====
  file: {
    selectDialog(filters?: FileFilter[]): Promise<string[] | null>;
    export(data: string, defaultName: string, format: 'md' | 'json' | 'txt'): Promise<string | null>;
    readAsBase64(path: string): Promise<{ name: string; type: string; data: string }>;
  };

  // ===== 数据库（预定义接口，不暴露 SQL） =====
  db: {
    conversations: {
      list(options?: { limit?: number; offset?: number; search?: string }): Promise<ConversationSummary[]>;
      get(id: string): Promise<Conversation | null>;
      save(conversation: Conversation): Promise<void>;
      delete(id: string): Promise<void>;
      updateTitle(id: string, title: string): Promise<void>;
    };
    messages: {
      list(conversationId: string): Promise<Message[]>;
      save(conversationId: string, message: Message): Promise<void>;
      delete(conversationId: string, messageId: string): Promise<void>;
    };
    prompts: {
      list(options?: { category?: string; search?: string }): Promise<PromptTemplate[]>;
      save(template: PromptTemplate): Promise<void>;
      delete(id: string): Promise<void>;
      incrementUsage(id: string): Promise<void>;
    };
  };

  // ===== MCP =====
  mcp: {
    server: {
      list(): Promise<MCPServerConfig[]>;
      save(config: MCPServerConfig): Promise<void>;
      delete(id: string): Promise<void>;
      connect(id: string): Promise<{ success: boolean; tools: Tool[] }>;
      disconnect(id: string): Promise<void>;
    };
    tool: {
      call(serverId: string, toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
    };
  };

  // ===== Skill =====
  skill: {
    list(): Promise<Skill[]>;
    save(skill: Skill): Promise<void>;
    delete(id: string): Promise<void>;
    execute(skillId: string, params: Record<string, unknown>): Promise<string>;
  };

  // ===== 存储 =====
  store: {
    get<T>(key: string, defaultValue?: T): Promise<T>;
    set(key: string, value: unknown): Promise<void>;
  };

  // ===== 系统 =====
  system: {
    openExternal(url: string): void;
    getInfo(): Promise<{ platform: string; version: string; electronVersion: string }>;
    getPath(name: 'home' | 'appData' | 'userData' | 'temp' | 'desktop'): Promise<string>;
  };

  // ===== 全局事件（主进程主动推送） =====
  on: {
    updaterStatus(callback: (status: UpdateStatus) => void): () => void;
    mcpServerDisconnect(callback: (serverId: string) => void): () => void;
  };
}
```

---

## 五、项目结构

```
ZeneAIHub/
├── electron/
│   ├── main.ts                          # 主进程入口
│   ├── preload.ts                       # 预加载脚本
│   ├── services/
│   │   ├── ai/
│   │   │   ├── AIService.ts             # AI 调用核心服务
│   │   │   ├── ProviderRegistry.ts      # Provider 注册与管理
│   │   │   ├── providers/
│   │   │   │   ├── BaseProvider.ts      # Provider 抽象基类
│   │   │   │   ├── OpenAIProvider.ts
│   │   │   │   ├── ClaudeProvider.ts
│   │   │   │   ├── GeminiProvider.ts
│   │   │   │   ├── OllamaProvider.ts
│   │   │   │   └── CustomProvider.ts    # 兼容 OpenAI API 的自定义服务
│   │   │   └── types.ts
│   │   ├── file/
│   │   │   └── FileService.ts
│   │   ├── storage/
│   │   │   ├── ConfigStore.ts           # electron-store 封装
│   │   │   ├── Database.ts              # better-sqlite3 封装
│   │   │   │   ├── index.ts             # 数据库实例管理
│   │   │   │   ├── migrations/          # 数据库迁移脚本
│   │   │   │   │   ├── 001_init.ts
│   │   │   │   │   └── ...
│   │   │   │   └── repositories/        # 数据访问层
│   │   │   │       ├── ConversationRepo.ts
│   │   │   │       ├── MessageRepo.ts
│   │   │   │       └── PromptRepo.ts
│   │   │   └── SecureStore.ts           # safeStorage API Key 加密存储
│   │   ├── mcp/
│   │   │   ├── MCPClient.ts             # MCP 协议客户端
│   │   │   ├── transports/
│   │   │   │   ├── StdioTransport.ts    # stdio 传输
│   │   │   │   └── SSETransport.ts      # SSE 传输
│   │   │   └── types.ts
│   │   ├── skill/
│   │   │   └── SkillService.ts
│   │   ├── logger/
│   │   │   └── Logger.ts                # 日志服务
│   │   └── system/
│   │       └── SystemService.ts
│   └── ipc/
│       ├── registerHandlers.ts          # 统一注册入口
│       ├── aiHandlers.ts
│       ├── modelHandlers.ts
│       ├── fileHandlers.ts
│       ├── dbHandlers.ts
│       ├── mcpHandlers.ts
│       ├── skillHandlers.ts
│       ├── storeHandlers.ts
│       └── systemHandlers.ts
│
├── shared/                              # 主进程与渲染进程共享类型
│   └── types/
│       ├── chat.ts
│       ├── model.ts
│       ├── prompt.ts
│       ├── skill.ts
│       ├── mcp.ts
│       ├── ipc.ts                       # IPC 通道名常量
│       ├── electron.d.ts                # window.electronAPI 类型声明
│       └── common.ts                    # StreamConfig / FileFilter / JSONSchema 等通用类型
│
├── src/                                 # React 渲染进程
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes.tsx
│   │
│   ├── pages/
│   │   ├── Chat/
│   │   │   ├── index.tsx                # 对话页面（双栏布局）
│   │   │   ├── components/
│   │   │   │   ├── ChatSidebar.tsx      # 会话列表侧栏（基于 Antd X Conversations）
│   │   │   │   ├── MessageList.tsx      # 消息列表（基于 Antd X Bubble.List + 虚拟滚动）
│   │   │   │   ├── ChatInput.tsx        # 输入框（基于 Antd X Sender + Attachments）
│   │   │   │   ├── PromptSuggestion.tsx # Prompt 快捷建议（基于 Antd X Prompts）
│   │   │   │   ├── ThoughtChainPanel.tsx# 推理链可视化（基于 Antd X ThoughtChain）
│   │   │   │   ├── MarkdownRenderer.tsx # Markdown 渲染（react-markdown 封装）
│   │   │   │   ├── CodeBlock.tsx        # 代码块（行号/复制/高亮）
│   │   │   │   ├── MermaidBlock.tsx     # Mermaid 图表渲染
│   │   │   │   ├── ModelSelector.tsx    # 模型选择器
│   │   │   │   ├── ToolCallCard.tsx     # 工具调用结果卡片
│   │   │   │   └── TokenCounter.tsx     # Token 消耗显示
│   │   │   └── hooks/
│   │   │       ├── useChat.ts           # 对话逻辑封装（useXChat 封装）
│   │   │       ├── useStreaming.ts      # 流式输出管理
│   │   │       └── useAutoScroll.ts     # 自动滚动到底部
│   │   │
│   │   ├── Models/
│   │   │   ├── index.tsx
│   │   │   ├── ModelList.tsx
│   │   │   ├── ModelForm.tsx
│   │   │   └── ApiKeyManager.tsx
│   │   │
│   │   ├── Files/
│   │   │   ├── index.tsx
│   │   │   ├── FileList.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── FilePreview.tsx
│   │   │
│   │   ├── Prompts/
│   │   │   ├── index.tsx
│   │   │   ├── TemplateList.tsx
│   │   │   ├── TemplateEditor.tsx
│   │   │   └── VariableInput.tsx
│   │   │
│   │   ├── Skills/
│   │   │   ├── index.tsx
│   │   │   ├── SkillList.tsx
│   │   │   ├── SkillEditor.tsx
│   │   │   └── SkillExecutor.tsx
│   │   │
│   │   ├── MCP/
│   │   │   ├── index.tsx
│   │   │   ├── ServerList.tsx
│   │   │   ├── ServerConfig.tsx
│   │   │   ├── ToolExplorer.tsx
│   │   │   └── ToolTester.tsx
│   │   │
│   │   └── Settings/
│   │       ├── index.tsx
│   │       ├── GeneralSettings.tsx
│   │       ├── ThemeSettings.tsx
│   │       ├── ProxySettings.tsx
│   │       └── AboutPanel.tsx
│   │
│   ├── components/                      # 全局共享组件
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx            # 主布局（侧栏 + 内容）
│   │   │   ├── StatusBar.tsx            # 底部状态栏
│   │   │   └── TitleBar.tsx             # 自定义标题栏（无边框窗口）
│   │   ├── common/
│   │   │   ├── ErrorBoundary.tsx        # React 错误边界
│   │   │   ├── ConfirmDialog.tsx        # 二次确认封装
│   │   │   ├── EmptyState.tsx           # 空状态占位
│   │   │   └── LoadingSpinner.tsx
│   │   └── DragDrop/
│   │       └── DropZone.tsx             # 通用拖拽上传区域
│   │
│   ├── stores/                          # Zustand 状态
│   │   ├── chatStore.ts
│   │   ├── modelStore.ts
│   │   ├── promptStore.ts
│   │   ├── skillStore.ts
│   │   ├── mcpStore.ts
│   │   └── uiStore.ts
│   │
│   ├── hooks/                           # 通用 Hooks
│   │   ├── useIPC.ts                    # IPC 调用封装
│   │   ├── useTheme.ts
│   │   └── useShortcut.ts
│   │
│   ├── services/                        # 渲染进程服务层
│   │   └── ipcBridge.ts                 # 类型安全的 IPC 调用代理
│   │
│   ├── utils/                           # 工具函数
│   │   ├── markdown.ts
│   │   ├── tokenizer.ts
│   │   ├── formatter.ts
│   │   └── uuid.ts
│   │
│   └── styles/                          # 全局样式
│       ├── global.css
│       └── theme.css
│
├── resources/                           # 静态资源
│   ├── icon.png
│   ├── icon.ico
│   ├── icon.icns
│   └── tray-icon.png
│
├── scripts/                             # 构建脚本
│   ├── electron-dev.ts                  # 开发环境启动
│   ├── notarize.js                      # macOS 公证
│   └── generate-icons.ts                # 多尺寸图标生成
│
├── package.json
├── tsconfig.json
├── tsconfig.node.json                   # Node.js/Electron 用 TS 配置
├── vite.config.ts                       # 渲染进程 Vite 配置
├── vite.electron.config.ts              # 主进程 Vite 配置
├── electron-builder.yml
├── tailwind.config.ts
├── eslint.config.js                   # ESLint 9+ flat config
├── .prettierrc
└── README.md
```

---

## 六、功能模块详细设计

### 6.1 AI 对话/聊天

**核心交互流程：**
```
用户输入 → 选择/确认模型 → 构建消息数组 → 流式调用
  → 主进程接收 SSE stream → 逐 chunk 通过 IPC 推送
  → 渲染进程增量拼接 + Markdown 渲染 → 保存到 SQLite
```

**关键设计点：**

- **UI 组件**：使用 Ant Design X 的 `Bubble`、`Sender`、`Conversations`、`Prompts`、`ThoughtChain`、`Attachments` 组件构建对话界面
- **流式输出**：主进程通过 `webContents.send` 逐 chunk 推送，渲染进程通过 Antd X `useXChat` hook 管理消息状态和流式拼接
- **多会话管理**：`Conversations` 组件提供会话列表，支持新建/重命名/删除/置顶/归档/分组
- **消息类型**：支持文本、代码块、Mermaid 图表、LaTeX 公式、图片、文件附件、工具调用结果
- **Markdown 渲染**：`react-markdown` + `remark-gfm` + `rehype-highlight` + `remark-math` + `rehype-katex`（嵌入 `Bubble` 的 `messageRender` 中）
- **代码高亮**：`rehype-highlight`（基于 highlight.js），支持 190+ 语言，带行号和复制按钮
- **Token 计数**：显示当前对话 token 消耗（各模型计数方式不同，使用 tiktoken/wcwidth 近似）
- **上下文管理**：滑动窗口策略，保留 system prompt + 最近 N 轮对话
- **虚拟滚动**：长对话使用 `@tanstack/virtual` 避免 DOM 膨胀
- **消息操作**：复制、重新生成、编辑后重发、分支对话（fork）
- **对话导出**：导出为 Markdown / JSON / HTML

**对话数据模型：**
```typescript
interface Conversation {
  id: string;                       // UUID
  title: string;                    // 首条消息摘要 / AI 自动生成
  modelId: string;                  // 关联 ModelConfig.id
  systemPrompt?: string;
  createdAt: number;                // Unix timestamp (ms)
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  metadata: {                       // 扩展字段
    totalTokens?: number;
    messageCount?: number;
  };
}

interface Message {
  id: string;                       // UUID
  conversationId: string;           // 外键
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  attachments?: Attachment[];
  toolCalls?: ToolCall[];
  tokenCount?: number;
  createdAt: number;
  // 用于分支对话
  parentMessageId?: string;
}

interface Attachment {
  id: string;
  name: string;
  type: string;                     // MIME type
  size: number;
  path: string;                     // 本地存储路径
  preview?: string;                 // base64 缩略图（图片类）
}
```

### 6.2 模型管理/配置

**支持的模型提供商：**
| Provider | 标识 | 默认 Base URL | 特殊处理 |
|----------|------|-------------|---------|
| OpenAI | `openai` | `https://api.openai.com/v1` | 标准 |
| Anthropic | `anthropic` | `https://api.anthropic.com` | 非 OpenAI 兼容，需独立实现 |
| Google | `google` | `https://generativelanguage.googleapis.com` | 独立 API 格式 |
| Ollama | `ollama` | `http://localhost:11434` | OpenAI 兼容 |
| LM Studio | `lmstudio` | `http://localhost:1234/v1` | OpenAI 兼容 |
| Custom | `custom` | 用户自定义 | 假设 OpenAI 兼容 |

**配置项：**
```typescript
// 渲染进程看到的脱敏版本
interface ModelConfigPublic {
  id: string;
  name: string;
  provider: ProviderType;
  hasApiKey: boolean;            // 是否已配置 Key（布尔值，不暴露 Key 本身）
  apiKeyMasked?: string;         // 脱敏显示 "sk-****xyz"
  baseUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;      // 频率惩罚
  presencePenalty: number;       // 存在惩罚
  enabled: boolean;
  order: number;
}

// 主进程存储的完整版本（apiKey 通过 SecureStore 单独存储）
interface ModelConfig extends ModelConfigPublic {
  apiKeyRef: string;             // SecureStore 中的引用键
}

// 渲染进程提交的输入
interface ModelConfigInput {
  id?: string;                   // 新建时为空
  name: string;
  provider: ProviderType;
  apiKey?: string;               // 仅提交时传递，主进程立即加密存储后丢弃
  baseUrl?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}
```

**安全策略：**
- API Key 通过 `electron.safeStorage` 加密后存储在 `SecureStore`，独立于 ModelConfig
- 渲染进程请求 `model:list()` 时，主进程组装脱敏后的 `ModelConfigPublic`
- 导出配置时 API Key 字段替换为占位符 `__REDACTED__`
- 渲染进程提交新 Key 时，主进程立即加密存储，内存中不保留明文

### 6.3 文件处理

**支持的文件类型与处理策略：**

| 类型 | 扩展名 | 处理方式 |
|------|--------|---------|
| 纯文本 | `.txt`, `.md`, `.json`, `.csv`, `.xml`, `.yaml`, `.toml` | 读取为文本内容直接发送 |
| 代码 | `.py`, `.js`, `.ts`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.rb` 等 | 同纯文本，带语言标注 |
| 文档 | `.pdf`, `.docx` | 通过解析库提取文本（Phase 2+） |
| 图片 | `.png`, `.jpg`, `.gif`, `.webp`, `.bmp` | base64 编码发送给视觉模型 |
| 数据 | `.xlsx`, `.xls` | 通过解析库提取表格数据（Phase 2+） |

**文件大小限制：**
- 文本/代码类：单文件 ≤ 10MB
- 图片类：单文件 ≤ 20MB
- 文档类：单文件 ≤ 50MB
- 对话总附件：≤ 100MB

**交互方式：**
- 拖拽文件到输入框（`DropZone` 组件）
- 点击附件按钮选择文件
- 粘贴剪贴板图片（`paste` 事件监听）
- 文件管理页面统一查看/删除

### 6.4 Prompt 模板库

**模板结构：**
```typescript
interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;               // 分类标识
  content: string;                // 支持 {{variable}} 变量语法
  variables: VariableDef[];       // 变量定义列表
  tags: string[];
  isFavorite: boolean;
  usageCount: number;             // 使用次数（排序/推荐用）
  isBuiltIn: boolean;             // 内置模板不可删除
  createdAt: number;
  updatedAt: number;
}

interface VariableDef {
  name: string;                   // 变量名，对应 {{name}}
  label: string;                  // 显示名
  type: 'text' | 'textarea' | 'select' | 'number';
  defaultValue?: string;
  options?: string[];             // select 类型的选项
  required: boolean;
  placeholder?: string;
}
```

**功能：**
- 分类管理（工作、编程、写作、翻译、分析等）
- 变量插值（选中模板时弹出变量填写 Drawer）
- 搜索（名称 + 标签 + 内容全文搜索）
- 收藏和使用计数
- JSON 导入/导出（标准格式，便于共享）
- 内置 20+ 常用模板

### 6.5 Skill 管理

**Skill 概念：**
Skill 是可复用的 AI 能力单元，封装了系统提示词、参数定义和可选的 MCP 工具绑定。

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  icon?: string;                   // emoji 或图标名
  category: string;
  systemPrompt: string;            // Skill 专用系统提示词
  parameters: SkillParam[];        // 用户输入参数
  modelId?: string;                // 可选指定模型（为空则使用当前模型）
  mcpTools?: string[];             // 绑定的 MCP 工具 ID 列表
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SkillParam {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'file';
  description: string;
  required: boolean;
  defaultValue?: string | number | boolean;
}
```

**调用方式：**
- 对话页面输入 `/skill-name` 触发
- Skill 管理页面点击执行按钮
- 侧栏快速访问（收藏的 Skill）

### 6.6 MCP 管理

**MCP（Model Context Protocol）客户端：**

支持连接 MCP Server，让 AI 调用外部工具。

```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  // stdio 模式
  command?: string;
  args?: string[];
  cwd?: string;                    // 工作目录
  env?: Record<string, string>;
  // SSE 模式
  url?: string;
  headers?: Record<string, string>;
  // 通用
  enabled: boolean;
  autoReconnect: boolean;
  reconnectInterval?: number;      // 自动重连间隔（秒）
  timeout?: number;                // 调用超时（毫秒）
}

interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;         // JSON Schema 定义参数
}

interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
```

**功能：**
- Server CRUD 管理
- 连接状态实时显示（连接中 / 已连接 / 断开 / 错误）
- 工具自动发现与列表展示
- 工具参数 JSON Schema → Antd Form 自动渲染
- 工具调用测试面板（输入参数 → 查看结果）
- 调用日志（时间、耗时、输入输出）
- 工具启用/禁用开关
- 导入/导出 Server 配置（JSON）

### 6.7 Claude Code Agent

> 详细方案见 `CLAUDE_CODE_AGENT_PLAN.md`

**核心架构：** 子进程包装 Claude Code CLI，通过 `--output-format stream-json` 获取结构化流式输出。

**关键组件：**

| 组件 | 位置 | 职责 |
|------|------|------|
| AgentService | `electron/services/agent/AgentService.ts` | CLI 子进程生命周期管理 |
| agentHandlers | `electron/ipc/agentHandlers.ts` | IPC 通道注册 |
| agentStore | `src/stores/agentStore.ts` | Agent 会话状态管理 |
| AgentChatPage | `src/pages/Agent/` | Agent 对话 UI |

**数据流：**
```
用户输入 → 渲染进程 → IPC → 主进程 → spawn claude CLI
                              ↓
                    stdout (stream-json) → 解析事件
                              ↓
                    IPC 推送 → 渲染进程增量渲染
```

**难点：**
1. CLI 的 stdin TTY 交互（交互式程序检测终端环境）
2. 工具调用执行前的用户确认机制（CLI 不原生支持暂停等待）
3. stream-json 格式的逆向推断与版本兼容
4. 子进程生命周期管理（僵尸进程、超时清理）

---

## 七、页面布局设计

### 7.1 整体布局

```
┌──────────────────────────────────────────────────────────────┐
│  [icon] ZeneAIHub                             — □ ×         │
│  (自定义标题栏，无边框窗口模式)                                 │
├────────┬─────────────────────────────────────────────────────┤
│        │                                                      │
│   [💬]  │                主内容区域                             │
│   [⚙]  │           (React Router Outlet)                     │
│   [📁]  │                                                      │
│   [📝]  │                                                      │
│   [🔧]  │                                                      │
│   [🔌]  │                                                      │
│        │                                                      │
│ ────── │                                                      │
│   [⚙]  │                                                      │
│        │                                                      │
├────────┴─────────────────────────────────────────────────────┤
│  [模型: GPT-4o] │ [Tokens: 12.3k] │ [已连接] │ v1.0.0       │
│  状态栏                                                         │
└──────────────────────────────────────────────────────────────┘
```

侧栏采用 **可折叠图标模式**：默认展开显示图标 + 文字，可折叠为仅图标（60px 宽）。

### 7.2 对话页面布局（Ant Design X 组件映射）

```
┌──────────────────────────────────────────────────────────────┐
│ ┌────────────────────┐                                        │
│ │ Conversations      │                                        │
│ │ (Antd X 组件)      │                                        │
│ │ ────────────────── │  ┌─────────────────────────────────┐  │
│ │ 今天               │  │ Bubble.List                      │  │
│ │  ├ 会话1 [当前]     │  │ (Antd X 组件)                    │  │
│ │  └ 会话2           │  │                                  │  │
│ │ 昨天               │  │  ┌────────────────────────────┐  │  │
│ │  ├ 会话3           │  │  │ Bubble (用户)               │  │  │
│ │  └ 会话4           │  │  │ content="用户消息"          │  │  │
│ │                    │  │  └────────────────────────────┘  │  │
│ │ [+ 新建]           │  │                                  │  │
│ │                    │  │  ┌────────────────────────────┐  │  │
│ │                    │  │  │ Bubble (AI)                │  │  │
│ │                    │  │  │ messageRender={Markdown}   │  │  │
│ │                    │  │  │                            │  │  │
│ │                    │  │  │ ```python                  │  │  │
│ │                    │  │  │ print("Hello")             │  │  │
│ │                    │  │  │ ```                        │  │  │
│ │                    │  │  │ [复制] [重新生成] [编辑]    │  │  │
│ │                    │  │  └────────────────────────────┘  │  │
│ │                    │  │                                  │  │
│ │                    │  │  ┌────────────────────────────┐  │  │
│ │                    │  │  │ ThoughtChain (推理过程)     │  │  │
│ │                    │  │  │ ▸ 思考: 正在分析...         │  │  │
│ │                    │  │  │ ▸ 调用工具: search         │  │  │
│ │                    │  │  └────────────────────────────┘  │  │
│ │                    │  └─────────────────────────────────┘  │
│ └────────────────────┘                                        │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Sender (Antd X)                                          │ │
│ │ 输入消息... (Enter 发送, Shift+Enter 换行)       [发送 ▶] │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────┐                                             │
│ │ Attachments  │  [图片.png] [doc.pdf] [×]    [📎] [🎤]     │
│ │ (Antd X)     │                                             │
│ └──────────────┘                                             │
│  [模型: GPT-4o ▾]  [Skill: 无 ▾]   [1.2k tokens]            │
│                                                              │
│  ┌──────────────────────────────────────┐                   │
│  │ Prompts (Antd X 快捷建议)             │                   │
│  │ [帮我写代码] [翻译] [分析数据] [总结]  │                   │
│  └──────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

**Ant Design X 组件与布局对应关系：**

| 区域 | Antd X 组件 | 说明 |
|------|------------|------|
| 会话侧栏 | `Conversations` | 会话列表，支持分组、搜索、右键菜单、拖拽排序 |
| 消息列表 | `Bubble` + `Bubble.List` | 消息气泡列表，`messageRender` 注入 Markdown 渲染 |
| 输入框 | `Sender` | 多行输入、Enter 发送、Shift+Enter 换行、快捷操作栏 |
| 附件区 | `Attachments` | 文件拖拽/选择、图片预览、文件列表管理 |
| 快捷建议 | `Prompts` | 底部/顶部 Prompt 快捷入口，支持分类 |
| 推理过程 | `ThoughtChain` | AI 思维链、工具调用过程可视化（类似 DeepSeek 思考过程） |

### 7.3 快捷键设计

| 快捷键 | 动作 |
|--------|------|
| `Ctrl+N` | 新建对话 |
| `Ctrl+Shift+N` | 新建窗口 |
| `Ctrl+W` | 关闭当前对话 |
| `Ctrl+,` | 打开设置 |
| `Ctrl+K` | 全局搜索（对话/模板/Skill） |
| `Ctrl+L` | 聚焦到输入框 |
| `Ctrl+1-6` | 切换侧栏页面 |
| `Ctrl+Shift+C` | 复制最后一条 AI 回复 |
| `Escape` | 取消流式输出 / 关闭弹窗 |

---

## 八、Ant Design + Ant Design X 使用策略

### 8.1 Ant Design（通用 UI 层）

| 场景 | Antd 组件 |
|------|----------|
| 布局 | Layout, Layout.Sider, Layout.Content, Flex, Splitter |
| 导航 | Menu (vertical), Segmented, Breadcrumb, Tabs |
| 数据展示 | Table, List, Card, Tag, Badge, Avatar, Collapse, Tree |
| 表单 | Form, Input, Input.TextArea, Select, Switch, Slider, InputNumber |
| 反馈 | Modal, Drawer, message, notification, Popconfirm, Alert, Tour |
| 按钮 | Button, Dropdown, FloatButton, Space |
| 输入 | AutoComplete, Mentions |
| 其他 | Watermark, ColorPicker, QRCode |

### 8.2 Ant Design X（AI 交互层）

| 组件 | 用途 | 使用场景 |
|------|------|---------|
| `Bubble` | 消息气泡 | 对话页面：用户/AI 消息展示，支持 `messageRender` 注入自定义渲染 |
| `Bubble.List` | 气泡列表 | 对话页面：消息列表容器，内置滚动管理 |
| `Conversations` | 会话管理列表 | 对话侧栏：会话分组、搜索、置顶、右键操作 |
| `Sender` | AI 输入框 | 对话页面底部：多行输入、Enter 发送、操作按钮栏 |
| `Attachments` | 文件附件管理 | 输入区域：拖拽上传、图片预览、文件列表 |
| `Prompts` | Prompt 快捷建议 | 对话页面：快捷入口面板，支持分类和图标 |
| `ThoughtChain` | 推理链可视化 | 对话页面：AI 思考过程、工具调用链展示 |
| `useXChat` | 对话管理 Hook | 业务逻辑：消息列表管理、流式拼接、loading 状态（`request` 回调对接 IPC 流式） |

> **注意**：Antd X 的 `useSSE` 是 HTTP SSE 专用 Hook，不适用于 Electron IPC 场景。
> 流式逻辑通过 `useXChat` 的 `request` 回调 + IPC 事件机制实现（详见 4.2 节）。

**Ant Design X 使用示例：**

```tsx
import { Bubble, Sender, Conversations, useXChat } from '@ant-design/x';
import { RobotOutlined, UserOutlined } from '@ant-design/icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Markdown 渲染器提取为稳定引用，避免每次 render 重建
const renderMarkdown = (content: string) => (
  <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
);

function ChatPage() {
  const { messages, onRequest } = useXChat({
    request: async (params) => {
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const removeChunk = window.electronAPI.ai.onStreamChunk(requestId, (chunk) => {
          // useXChat 内部管理流式拼接
        });
        const removeDone = window.electronAPI.ai.onStreamDone(requestId, () => {
          cleanup();
          resolve();
        });
        const removeError = window.electronAPI.ai.onStreamError(requestId, (err) => {
          cleanup();
          reject(new Error(err));
        });
        const cleanup = () => { removeChunk(); removeDone(); removeError(); };
        window.electronAPI.ai.startStream(requestId, params.messages, currentConfig);
      });
    },
  });

  return (
    <Layout hasSider>
      <Layout.Sider width={260}>
        <Conversations
          items={conversationItems}
          activeKey={activeId}
          onActiveChange={setActiveId}
          groupable
        />
      </Layout.Sider>

      <Layout.Content>
        <Bubble.List
          items={messages.map(msg => ({
            key: msg.id,
            role: msg.role,
            content: msg.content,
            messageRender: renderMarkdown,
            avatar: msg.role === 'assistant'
              ? { icon: <RobotOutlined /> }
              : { icon: <UserOutlined /> },
          }))}
        />
        <Sender
          placeholder="输入消息..."
          onSubmit={(text) => onRequest({ message: text })}
        />
      </Layout.Content>
    </Layout>
  );
}
```

### 8.3 Ant Design X 与自定义组件的分工

| 功能 | 方案 | 理由 |
|------|------|------|
| 消息气泡 | **Antd X `Bubble`** | 开箱即用，支持头像、loading、流式动画 |
| 会话列表 | **Antd X `Conversations`** | 内置分组、搜索、右键菜单，省去大量工作 |
| 输入框 | **Antd X `Sender`** | 内置多行、附件栏、操作按钮，标准 AI 输入体验 |
| 文件附件 | **Antd X `Attachments`** | 拖拽上传、预览、列表管理 |
| 推理链 | **Antd X `ThoughtChain`** | 专用 AI 思维链组件，手动实现成本高 |
| 代码高亮 | **自定义 `CodeBlock`** | Antd X 不内置，需 react-markdown + rehype-highlight |
| Mermaid 图表 | **自定义 `MermaidBlock`** | 专用渲染需求，无现成组件 |
| 模型选择器 | **自定义 `ModelSelector`** | 业务特定 UI，用 antd Select/Dropdown 即可 |
| Token 计数 | **自定义 `TokenCounter`** | 简单展示组件，Antd Tag + Tooltip 即可 |

### 8.4 样式隔离方案

Ant Design 5.x 使用 CSS-in-JS（cssinjs），与 Tailwind 的类名冲突风险较低，但仍需注意：

```typescript
// tailwind.config.ts
export default {
  // 方案 A：Tailwind 仅用于自定义组件，antd 组件不用 Tailwind
  // 方案 B：添加前缀隔离
  prefix: 'tw-',
  // 推荐方案 A，避免类名污染
  corePlugins: {
    preflight: false,  // 禁用 Tailwind 的 CSS Reset，避免覆盖 antd 样式
  },
};
```

### 8.5 主题定制

```typescript
// theme.ts
import { theme, type ThemeConfig } from 'antd';

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#fafafa',
      headerBg: '#ffffff',
    },
  },
};

export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1668dc',
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Layout: {
      siderBg: '#141414',
      headerBg: '#1f1f1f',
    },
    Menu: {
      darkItemBg: '#141414',
      darkSubMenuItemBg: '#0a0a0a',
    },
  },
  algorithm: theme.darkAlgorithm,
};
```

---

## 九、数据存储方案

### 9.1 存储分层

| 数据类型 | 存储方式 | 路径 | 说明 |
|---------|---------|------|------|
| 应用配置 | electron-store | `userData/config.json` | 模型列表、UI 偏好、快捷键 |
| API Key | safeStorage | `userData/secrets.bin` | AES 加密，依赖 OS 密钥链 |
| 对话数据 | SQLite | `userData/data.db` | 对话、消息、模板 |
| 附件文件 | 文件系统 | `userData/attachments/` | 按年月分目录 |
| 日志 | 文件系统 | `userData/logs/` | 按日期滚动 |
| MCP/Skill 配置 | JSON 文件 | `userData/mcp-servers.json` | 便于导入导出 |

### 9.2 SQLite 表结构

```sql
-- 对话表
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '新对话',
  model_id TEXT,
  system_prompt TEXT,
  pinned INTEGER DEFAULT 0,
  archived INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',               -- JSON array
  total_tokens INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_conv_updated ON conversations(updated_at DESC);
CREATE INDEX idx_conv_pinned ON conversations(pinned, updated_at DESC);

-- 消息表
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  attachments TEXT DEFAULT '[]',        -- JSON array
  tool_calls TEXT DEFAULT '[]',         -- JSON array
  token_count INTEGER,
  parent_message_id TEXT,               -- 分支对话用
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_msg_conv ON messages(conversation_id, created_at ASC);

-- Prompt 模板表
CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  content TEXT NOT NULL,
  variables TEXT DEFAULT '[]',          -- JSON array
  tags TEXT DEFAULT '[]',               -- JSON array
  is_favorite INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  is_built_in INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_prompt_category ON prompt_templates(category);
CREATE INDEX idx_prompt_usage ON prompt_templates(usage_count DESC);

-- Skill 表
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  system_prompt TEXT NOT NULL,
  parameters TEXT DEFAULT '[]',         -- JSON array
  model_id TEXT,
  mcp_tools TEXT DEFAULT '[]',          -- JSON array
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- MCP 调用日志表
CREATE TABLE mcp_call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_args TEXT,
  output_result TEXT,
  is_error INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_mcp_log_time ON mcp_call_logs(created_at DESC);

-- 消息全文搜索
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- FTS 触发器：保持全文搜索索引同步
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

### 9.3 数据库迁移策略

```
electron/services/storage/migrations/
├── 001_init.ts              # conversations + messages + prompt_templates + FTS
├── 002_add_skills.ts        # Phase 3: skills 表
├── 003_add_mcp_logs.ts      # Phase 3: mcp_call_logs 表
└── ...
```

迁移方案：
- `Database.ts` 维护 `user_version` PRAGMA
- 启动时检查当前版本 vs 目标版本
- 按顺序执行未运行的迁移脚本
- 每个迁移脚本导出 `up(db)` 和 `down(db)`
- **001_init.ts 仅创建 Phase 1 需要的表**（conversations, messages, prompt_templates, messages_fts）
- 后续迁移按 Phase 添加新表，避免表已存在的冲突

---

## 十、窗口管理设计

### 10.1 窗口类型

| 窗口类型 | 用途 | 数量 |
|---------|------|------|
| 主窗口 | 应用主界面 | 1 |
| 设置窗口 | 偏好设置（可选独立窗口或 Drawer） | 0-1 |
| 快捷对话窗口 | 全局唤起的快速对话（类似 Spotlight） | 0-1 |

### 10.2 窗口配置

```typescript
// 主窗口
const mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  frame: false,               // 无边框（自定义标题栏）
  titleBarStyle: 'hidden',
  trafficLightPosition: { x: 12, y: 12 },  // macOS 交通灯位置
  webPreferences: {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  },
});
```

### 10.3 单实例锁

确保应用只能运行一个实例，重复启动时聚焦到已有窗口：

```typescript
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
```

---

## 十一、日志与错误处理

### 11.1 日志分级

| 级别 | 用途 | 输出位置 |
|------|------|---------|
| ERROR | 未捕获异常、API 调用失败 | 控制台 + 文件 |
| WARN | 重试操作、降级处理 | 控制台 + 文件 |
| INFO | 应用启动、配置变更、连接状态 | 控制台 + 文件 |
| DEBUG | IPC 调用、SQL 查询 | 仅开发环境控制台 |

### 11.2 全局错误处理

**主进程：**
```typescript
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  // 不立即退出，尝试通知渲染进程
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', reason);
});
```

**渲染进程：**
```tsx
// ErrorBoundary 组件包裹整个应用
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

### 11.3 日志文件

- 路径：`userData/logs/YYYY-MM-DD.log`
- 单文件最大：10MB
- 保留天数：30 天
- 格式：`[ISO timestamp] [LEVEL] [module] message`

---

## 十二、开发工作流

### 12.1 开发模式

```bash
# 安装依赖
pnpm install

# 启动开发环境（Vite dev server + Electron，热重载）
pnpm dev

# 仅启动渲染进程（浏览器调试 UI，不启动 Electron）
pnpm dev:renderer

# 类型检查（渲染进程 + 主进程）
pnpm typecheck

# 代码检查
pnpm lint

# 格式化
pnpm format

# 单元测试
pnpm test

# E2E 测试
pnpm test:e2e

# 构建
pnpm build

# 打包（Windows/macOS/Linux）
pnpm dist

# 打包当前平台
pnpm dist:win
pnpm dist:mac
pnpm dist:linux
```

### 12.2 Vite 配置要点

渲染进程使用标准 Vite 配置，主进程需要单独的 Vite 配置（构建为 Node.js CJS）：

```typescript
// vite.config.ts — 渲染进程
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
  },
  base: './',                  // Electron 打包后使用相对路径
  build: {
    outDir: 'dist/renderer',
  },
});

// vite.electron.config.ts — 主进程
export default defineConfig({
  build: {
    outDir: 'dist/electron',
    lib: {
      entry: 'electron/main.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron', 'better-sqlite3', 'electron-store'],
    },
  },
});
```

### 12.3 Git 分支策略

```
main          ← 稳定发布（tagged releases）
  │
  └── dev     ← 开发主分支
        ├── feature/chat-streaming
        ├── feature/mcp-management
        ├── fix/window-focus-bug
        └── chore/upgrade-electron
```

### 12.4 提交规范

```
feat(chat): 添加流式对话支持
fix(mcp): 修复 stdio 连接超时问题
docs(readme): 更新安装说明
refactor(store): 重构配置存储层
chore(deps): 升级 electron 到 35.0
test(chat): 添加 useStreaming hook 测试
```

---

## 十三、依赖清单

### 核心依赖

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0",
    "antd": "^5.24.0",
    "@ant-design/x": "^1.0.0",
    "@ant-design/icons": "^5.5.0",
    "zustand": "^5.0.0",
    "@tanstack/virtual": "^3.0.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "remark-math": "^6.0.0",
    "rehype-highlight": "^7.0.0",
    "rehype-katex": "^7.0.0",
    "better-sqlite3": "^11.0.0",
    "electron-store": "^10.0.0",
    "electron-updater": "^6.0.0",
    "uuid": "^11.0.0",
    "eventsource-parser": "^3.0.0",
    "highlight.js": "^11.0.0",
    "katex": "^0.16.0"
  },
  "devDependencies": {
    "electron": "^34.0.0",
    "electron-builder": "^25.0.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.7.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "vitest": "^3.0.0",
    "@playwright/test": "^1.50.0",
    "playwright-core": "^1.50.0",
    "eslint": "^9.0.0",
    "prettier": "^3.4.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "@types/better-sqlite3": "^7.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/uuid": "^10.0.0"
  }
}
```

### 移除的依赖

| 依赖 | 原移除理由 |
|------|-----------|
| `@tanstack/react-query` | 本地 IPC 应用无 HTTP 缓存需求，Zustand 足以覆盖 |
| `unplugin-auto-import` | 隐式导入降低可读性，大型项目不推荐 |

### 新增的依赖

| 依赖 | 理由 |
|------|------|
| `@ant-design/x` | AI 专用组件库（Bubble/Sender/Conversations/ThoughtChain 等） |
| `@tanstack/virtual` | 长对话虚拟滚动，避免 DOM 膨胀 |
| `electron-updater` | 自动更新功能必须 |
| `remark-math` + `rehype-katex` + `katex` | AI 回复中数学公式渲染 |
| `highlight.js` | rehype-highlight 的底层依赖，版本锁定 |
| `@types/*` | TypeScript 类型定义，开发时必须 |

---

## 十四、后续演进路线

### Phase 1（MVP）— 预计 3-4 周
- [x] 项目脚手架搭建（Electron + Vite + React + TypeScript）
- [ ] 基础对话功能（Antd X Bubble + Sender + useXChat 流式输出）
- [ ] 模型配置管理（至少支持 OpenAI + Claude）
- [ ] 对话历史存储（SQLite）
- [ ] 自定义标题栏 + 侧栏导航（Antd X Conversations）
- [ ] 暗色/亮色主题切换
- [ ] Markdown 渲染（代码高亮 + 表格）

> 注：Phase 1 时间从 4-6 周缩短到 3-4 周，因为 Ant Design X 提供了开箱即用的
> Bubble、Sender、Conversations 组件，省去了大量 UI 开发工作。

### Phase 2 — 预计 3-4 周
- [ ] Prompt 模板库
- [ ] 文件上传与图片处理
- [ ] 多会话管理 + 搜索
- [ ] 导出对话（Markdown / JSON）
- [ ] 全局搜索（Ctrl+K）

### Phase 3 — 预计 3-4 周
- [ ] MCP Server 管理（stdio + SSE）
- [ ] Skill 管理 + `/skill` 快捷调用
- [ ] 工具调用可视化
- [ ] Mermaid 图表 / LaTeX 公式渲染

### Phase 4 — 预计 2-3 周
- [ ] 本地模型集成（Ollama / LM Studio）
- [ ] 应用自动更新（electron-updater）
- [ ] 对话导出为 PDF / HTML
- [ ] 快捷键全局唤起窗口
- [ ] 日志查看器

---

## 附录：关键决策记录

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| ADR-001 | 桌面框架 | Electron 而非 Tauri | 团队更熟悉 JS 生态，Electron 成熟稳定，Tauri 需要 Rust 且 macOS/Linux 兼容性仍有坑 |
| ADR-002 | UI 库 | Ant Design + Ant Design X | Antd 通用组件 + Antd X AI 专用组件，同一体系无缝混用，避免从零搭建对话 UI |
| ADR-003 | 状态管理 | Zustand 而非 Redux | 无样板代码，API 简洁，学习成本低，对中型项目足够 |
| ADR-004 | 数据库 | SQLite 而非 JSON 文件 | 对话数据量大时查询性能更好，支持全文搜索（FTS5），事务安全 |
| ADR-005 | 构建工具 | Vite 而非 Webpack | 开发体验更好，HMR 速度快，配置简洁 |
| ADR-006 | 包管理 | pnpm 而非 npm/yarn | 速度快，磁盘占用小，monorepo 友好 |
| ADR-007 | 移除 TanStack Query | 纯 Zustand | 本地 IPC 应用无 HTTP 缓存需求，避免过度工程化 |
| ADR-008 | 禁止暴露 SQL | 预定义 Repository 接口 | 防止渲染进程注入恶意 SQL，安全红线 |
| ADR-009 | 流式通信 | 事件机制而非回调 | IPC 不支持函数序列化，事件订阅 + 手动清理是 Electron 标准做法 |
| ADR-010 | Tailwind 前缀 | 禁用 preflight，antd 区域不用 Tailwind | 避免 CSS Reset 冲突，保持 antd 样式完整性 |
| ADR-011 | AI 对话 UI | Ant Design X 而非自研 | 官方 AI 组件库，与 antd 5.x 共享主题，省去 Bubble/Sender/Conversations 等组件开发量 |
