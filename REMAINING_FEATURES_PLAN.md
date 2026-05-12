# ZeneAIHub 剩余功能模块实施方案

> 版本：v1.0 | 日期：2026-05-09 | 状态：规划中
>
> 涵盖：文件处理、Prompt 模板库、Skill 管理、MCP 管理

---

## 一、文件处理

### 1.1 功能概述

支持在对话中上传文件附件，AI 可读取文件内容进行分析。支持文本/代码/图片/文档等多种格式。

### 1.2 技术方案

**主进程：文件服务**

| 任务 | 方案 |
|------|------|
| 文件选择对话框 | `dialog.showOpenDialog`（已有 `fileHandlers.ts`） |
| 文本/代码读取 | `fs.readFileSync` 直接读取 |
| 图片读取 | `fs.readFileSync` → base64 编码 |
| PDF 解析 | `pdf-parse` 库提取文本 |
| DOCX 解析 | `mammoth` 库提取文本 |
| Excel 解析 | `xlsx` 库提取表格数据 |
| 文件暂存 | `app.getPath('temp')` 下创建会话临时目录 |
| 文件导出 | `dialog.showSaveDialog` + `fs.writeFileSync`（已有） |

**渲染进程：附件组件**

使用 Ant Design X 的 `Attachments` 组件实现文件上传 UI，支持拖拽、粘贴、点击选择。

### 1.3 新增/修改文件清单

```
electron/
  services/
    file/
      FileProcessor.ts          # 文件读取/解析（文本、图片、PDF、DOCX）
  ipc/
    fileHandlers.ts             # 扩展：增加 file:read、file:parse 通道

shared/
  types/
    file.ts                     # FileAttachment、FileParseResult 类型定义

src/
  components/
    file/
      FileUploader.tsx          # 上传区域（拖拽 + 粘贴 + 点击）
      FilePreview.tsx           # 文件预览（图片缩略图、文本摘要）
      FileCard.tsx              # 附件卡片（显示文件名、大小、类型）
  stores/
    fileStore.ts                # 上传状态管理
  services/
    ipcBridge.ts                # 扩展 api.file 命名空间
```

### 1.4 IPC 通道扩展

| 通道 | 方向 | 参数 | 说明 |
|------|------|------|------|
| `file:read` | 渲染→主 | `{ path: string }` | 读取文件为文本/base64 |
| `file:parse` | 渲染→主 | `{ path: string, type: string }` | 解析 PDF/DOCX/Excel |
| `file:info` | 渲染→主 | `{ path: string }` | 获取文件元信息（大小、MIME） |

### 1.5 数据库扩展

在 `messages` 表的 `attachments` JSON 字段中存储附件信息：

```sql
-- messages 表已有 attachments 字段（JSON）
-- 结构：
[
  {
    "id": "uuid",
    "name": "report.pdf",
    "type": "application/pdf",
    "size": 1048576,
    "path": "/tmp/zeneaihub/session-xxx/report.pdf",
    "preview": null
  }
]
```

### 1.6 文件处理流程

```
用户拖拽文件到输入框
  → FileUploader 读取文件信息（name, size, type）
  → 渲染进程通过 file:read 或 file:parse 获取内容
  → 文本类：直接附加到消息 content
  → 图片类：base64 编码，作为 message 的 image_url 发送
  → 附件信息存入 message.attachments JSON 字段
```

### 1.7 实施步骤

| 步骤 | 任务 |
|------|------|
| 1 | 定义 `shared/types/file.ts` 类型 |
| 2 | 实现 `FileProcessor.ts`（文本/图片读取 + PDF/DOCX/Excel 解析） |
| 3 | 扩展 `fileHandlers.ts`（file:read、file:parse） |
| 4 | 扩展 `preload.ts` + `ipcBridge.ts` |
| 5 | 实现 `FileUploader.tsx`（拖拽/粘贴/选择） |
| 6 | 实现 `FilePreview.tsx` + `FileCard.tsx` |
| 7 | 集成到 `ChatInput.tsx`（Attachments 组件） |
| 8 | 集成到 `MessageList.tsx`（消息中的附件展示） |

---

## 二、Prompt 模板库

### 2.1 功能概述

管理可复用的 Prompt 模板，支持变量插值、分类、搜索、导入导出。

### 2.2 数据模型

```typescript
interface PromptTemplate {
  id: string;
  name: string;                    // 模板名称
  description: string;             // 描述
  category: string;                // 分类标识
  content: string;                 // 模板内容，支持 {{variable}} 变量语法
  variables: VariableDef[];        // 变量定义列表
  tags: string[];                  // 标签
  isFavorite: boolean;             // 收藏
  usageCount: number;              // 使用次数
  isBuiltIn: boolean;              // 内置模板不可删除
  createdAt: number;
  updatedAt: number;
}

interface VariableDef {
  name: string;                    // 变量名，对应 {{name}}
  label: string;                   // 显示名
  type: 'text' | 'textarea' | 'select' | 'number';
  defaultValue?: string;
  options?: string[];              // select 类型的选项
  required: boolean;
  placeholder?: string;
}
```

### 2.3 SQLite 表设计

```sql
CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  variables TEXT DEFAULT '[]',      -- JSON: VariableDef[]
  tags TEXT DEFAULT '[]',           -- JSON: string[]
  is_favorite INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  is_built_in INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_prompt_category ON prompt_templates(category);
CREATE INDEX idx_prompt_favorite ON prompt_templates(is_favorite);
```

### 2.4 新增/修改文件清单

```
electron/
  services/
    storage/
      repositories/
        PromptRepo.ts             # 模板 CRUD + 搜索
  ipc/
    promptHandlers.ts             # prompt:* IPC 处理

shared/
  types/
    prompt.ts                     # PromptTemplate、VariableDef 类型

src/
  pages/
    Prompts/
      index.tsx                   # 模板库主页面
      components/
        PromptList.tsx            # 模板列表（分类 + 搜索）
        PromptEditor.tsx          # 模板编辑器（Monaco Editor / CodeMirror）
        PromptPreview.tsx         # 模板预览 + 变量填写
        VariableDrawer.tsx        # 变量填写抽屉
        CategoryTree.tsx          # 分类树
        ImportExport.tsx          # 导入导出
  stores/
    promptStore.ts                # 模板状态管理
```

### 2.5 IPC 通道

| 通道 | 参数 | 说明 |
|------|------|------|
| `prompt:list` | `{ category?, search?, favorite? }` | 查询模板列表 |
| `prompt:get` | `{ id }` | 获取单个模板 |
| `prompt:save` | `PromptTemplate` | 创建/更新模板 |
| `prompt:delete` | `{ id }` | 删除模板（内置不可删） |
| `prompt:use` | `{ id, variables }` | 变量插值，返回填充后的内容 |
| `prompt:increment` | `{ id }` | 使用计数 +1 |
| `prompt:export` | `{ ids }` | 导出为 JSON |
| `prompt:import` | `{ json }` | 从 JSON 导入 |

### 2.6 变量插值引擎

```typescript
function interpolateVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    return variables[name] ?? match; // 未赋值的变量保留原样
  });
}
```

### 2.7 内置模板（20+）

| 分类 | 模板示例 |
|------|---------|
| 编程 | 代码审查、重构建议、生成单元测试、解释代码、生成 API 文档 |
| 写作 | 润色文章、改写段落、生成大纲、翻译（中↔英）、总结摘要 |
| 分析 | 数据分析、竞品对比、SWOT 分析、需求拆解 |
| 通用 | 角色扮演、头脑风暴、决策矩阵、概念解释 |

### 2.8 实施步骤

| 步骤 | 任务 |
|------|------|
| 1 | 定义 `shared/types/prompt.ts` 类型 |
| 2 | 实现 `PromptRepo.ts`（SQLite CRUD + 搜索） |
| 3 | 实现 `promptHandlers.ts` + 注册 IPC |
| 4 | 扩展 `preload.ts` + `ipcBridge.ts` |
| 5 | 实现 `promptStore.ts` |
| 6 | 实现模板列表页 `PromptList.tsx` + `CategoryTree.tsx` |
| 7 | 实现模板编辑器 `PromptEditor.tsx` |
| 8 | 实现变量填写 `VariableDrawer.tsx` |
| 9 | 集成到对话页：输入框 `/` 触发模板选择 |
| 10 | 实现导入导出 |
| 11 | 写入内置模板数据 |

---

## 三、Skill 管理

### 3.1 功能概述

Skill 是可复用的 AI 能力单元，封装系统提示词 + 参数定义 + 可选 MCP 工具绑定。相比 Prompt 模板，Skill 可以绑定工具、指定模型，是更高阶的能力抽象。

### 3.2 数据模型

```typescript
interface Skill {
  id: string;
  name: string;                    // 技能名称
  description: string;             // 描述
  icon: string;                    // emoji 图标
  category: string;                // 分类
  systemPrompt: string;            // 技能专用系统提示词
  parameters: SkillParam[];        // 用户输入参数
  modelId?: string;                // 可选指定模型（为空则使用当前模型）
  mcpTools: string[];              // 绑定的 MCP 工具名列表
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

### 3.3 SQLite 表设计

```sql
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  system_prompt TEXT NOT NULL,
  parameters TEXT DEFAULT '[]',     -- JSON: SkillParam[]
  model_id TEXT,                    -- 可选，关联 models.id
  mcp_tools TEXT DEFAULT '[]',      -- JSON: string[]
  enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 3.4 新增/修改文件清单

```
electron/
  services/
    storage/
      repositories/
        SkillRepo.ts              # Skill CRUD
  ipc/
    skillHandlers.ts              # skill:* IPC 处理

shared/
  types/
    skill.ts                      # Skill、SkillParam 类型

src/
  pages/
    Skills/
      index.tsx                   # Skill 管理主页面
      components/
        SkillList.tsx             # Skill 列表（卡片/列表视图）
        SkillEditor.tsx           # Skill 编辑弹窗
        SkillExecute.tsx          # Skill 执行面板（参数填写 → 结果展示）
        SkillCard.tsx             # Skill 卡片组件
  stores/
    skillStore.ts                 # Skill 状态管理
```

### 3.5 IPC 通道

| 通道 | 参数 | 说明 |
|------|------|------|
| `skill:list` | `{ category?, search? }` | 查询 Skill 列表 |
| `skill:get` | `{ id }` | 获取单个 Skill |
| `skill:save` | `Skill` | 创建/更新 Skill |
| `skill:delete` | `{ id }` | 删除 Skill |
| `skill:execute` | `{ skillId, params }` | 执行 Skill（构建完整 prompt → 对话） |

### 3.6 Skill 执行流程

```
用户选择 Skill → 填写参数
  → skill:execute → 主进程拼接 systemPrompt + 参数
  → 创建新对话 / 在当前对话中追加
  → 如绑定了 MCP 工具，将工具定义注入 messages 的 tools 字段
  → 发起流式对话
```

### 3.7 与对话系统的集成

- **对话页快捷触发**：输入框输入 `/` 弹出 Skill 列表，选择后填写参数
- **Skill 页面直接执行**：点击执行按钮 → 参数填写弹窗 → 跳转到对话页开始对话
- **侧栏快捷入口**：收藏的 Skill 显示在侧栏，一键触发

### 3.8 实施步骤

| 步骤 | 任务 |
|------|------|
| 1 | 定义 `shared/types/skill.ts` 类型 |
| 2 | 实现 `SkillRepo.ts`（SQLite CRUD） |
| 3 | 实现 `skillHandlers.ts` + 注册 IPC |
| 4 | 扩展 `preload.ts` + `ipcBridge.ts` |
| 5 | 实现 `skillStore.ts` |
| 6 | 实现 Skill 列表页 + 卡片视图 |
| 7 | 实现 Skill 编辑弹窗（系统提示词 + 参数定义 + MCP 工具绑定） |
| 8 | 实现 Skill 执行面板（参数填写 → 调用对话） |
| 9 | 集成到对话页：`/` 快捷触发 |
| 10 | 内置 5-10 个常用 Skill |

---

## 四、MCP 管理

### 4.1 功能概述

MCP（Model Context Protocol）客户端，支持连接外部 MCP Server，让 AI 调用外部工具。支持 stdio 和 SSE 两种传输方式。

### 4.2 技术方案

**依赖：** `@modelcontextprotocol/sdk`（官方 TypeScript SDK）

```
npm install @modelcontextprotocol/sdk
```

**核心概念：**
- **MCP Server**：提供工具的外部服务进程（如文件系统工具、数据库工具等）
- **Transport**：通信方式 — `stdio`（子进程）或 `SSE`（HTTP 长连接）
- **Tool**：Server 暴露的可调用函数，通过 JSON Schema 定义参数

### 4.3 数据模型

```typescript
interface MCPServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  // stdio 模式
  command?: string;                // 如 "npx", "node"
  args?: string[];                 // 如 ["-y", "@modelcontextprotocol/server-filesystem"]
  cwd?: string;                    // 工作目录
  env?: Record<string, string>;    // 环境变量
  // SSE 模式
  url?: string;                    // 如 "http://localhost:3001/sse"
  headers?: Record<string, string>;
  // 通用
  enabled: boolean;
  autoReconnect: boolean;
  reconnectInterval?: number;      // 秒
  timeout?: number;                // 毫秒
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema7;        // JSON Schema v7
  serverId: string;                // 所属 Server
}

interface MCPToolCall {
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;                 // base64 for images
    mimeType?: string;
  }>;
  isError: boolean;
}
```

### 4.4 SQLite 表设计

```sql
CREATE TABLE mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  transport TEXT NOT NULL DEFAULT 'stdio',
  command TEXT,
  args TEXT DEFAULT '[]',          -- JSON: string[]
  cwd TEXT,
  env TEXT DEFAULT '{}',           -- JSON: Record<string, string>
  url TEXT,
  headers TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 1,
  auto_reconnect INTEGER DEFAULT 0,
  reconnect_interval INTEGER DEFAULT 30,
  timeout INTEGER DEFAULT 60000,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 4.5 新增/修改文件清单

```
electron/
  services/
    mcp/
      MCPClient.ts                # MCP 客户端核心（连接、工具发现、调用）
      MCPManager.ts               # 多 Server 管理（生命周期、状态监控）
  ipc/
    mcpHandlers.ts                # mcp:* IPC 处理

shared/
  types/
    mcp.ts                        # MCPServerConfig、MCPTool、MCPToolResult 类型

src/
  pages/
    MCP/
      index.tsx                   # MCP 管理主页面
      components/
        ServerList.tsx            # Server 列表（连接状态实时显示）
        ServerEditor.tsx          # Server 配置编辑弹窗
        ToolList.tsx              # 工具列表（所属 Server、参数 Schema）
        ToolTestPanel.tsx         # 工具调用测试面板
        ToolCallLog.tsx           # 调用日志
  stores/
    mcpStore.ts                   # MCP 状态管理
```

### 4.6 IPC 通道

| 通道 | 参数 | 说明 |
|------|------|------|
| `mcp:server:list` | — | 查询 Server 列表 |
| `mcp:server:save` | `MCPServerConfig` | 创建/更新 Server 配置 |
| `mcp:server:delete` | `{ id }` | 删除 Server 配置 |
| `mcp:server:connect` | `{ id }` | 连接 Server |
| `mcp:server:disconnect` | `{ id }` | 断开 Server |
| `mcp:tool:list` | `{ serverId? }` | 查询已连接 Server 的工具列表 |
| `mcp:tool:call` | `{ serverId, toolName, args }` | 调用工具 |
| `mcp:status` | — | 获取所有 Server 连接状态 |
| `mcp:status:${serverId}` | 主→渲染 | Server 状态变更推送 |

### 4.7 MCPManager 核心逻辑

```typescript
class MCPManager {
  private clients: Map<string, MCPClient> = new Map();
  private statusListeners: Map<string, (status: string) => void> = new Map();

  async connect(config: MCPServerConfig): Promise<void> {
    const client = new MCPClient(config);
    await client.connect();
    this.clients.set(config.id, client);
    // 自动发现工具
    const tools = await client.listTools();
    // 推送状态变更
  }

  async disconnect(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (client) {
      await client.disconnect();
      this.clients.delete(serverId);
    }
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const client = this.clients.get(serverId);
    if (!client) throw new Error(`Server ${serverId} not connected`);
    return await client.callTool(toolName, args);
  }

  /** 获取所有可用工具（用于注入 AI 对话） */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const [serverId, client] of this.clients) {
      tools.push(...client.getTools().map(t => ({ ...t, serverId })));
    }
    return tools;
  }
}
```

### 4.8 与 AI 对话的集成

MCP 工具以 OpenAI function calling 格式注入对话请求：

```typescript
// AIService.startStream 中
const mcpTools = mcpManager.getAllTools();
const openaiTools = mcpTools.map(tool => ({
  type: 'function',
  function: {
    name: `${tool.serverId}__${tool.name}`,  // 避免命名冲突
    description: tool.description,
    parameters: tool.inputSchema,
  },
}));

// 将 tools 字段传入 API 请求
// AI 返回 tool_calls → 路由到 MCPManager.callTool → 将结果追加到 messages → 继续对话
```

### 4.9 工具参数自动表单

根据 JSON Schema 自动生成 Antd 表单：

```typescript
function schemaToFormItems(schema: JSONSchema7): FormItemProps[] {
  // 解析 JSON Schema properties
  // string → Input
  // number → InputNumber
  // boolean → Switch
  // enum → Select
  // array → 多选 / 列表输入
  // object → 嵌套分组
}
```

### 4.10 实施步骤

| 步骤 | 任务 |
|------|------|
| 1 | 安装 `@modelcontextprotocol/sdk` 依赖 |
| 2 | 定义 `shared/types/mcp.ts` 类型 |
| 3 | 实现 `MCPClient.ts`（连接、工具发现、调用） |
| 4 | 实现 `MCPManager.ts`（多 Server 生命周期管理） |
| 5 | 实现 `mcpHandlers.ts` + 注册 IPC |
| 6 | 创建 `mcp_servers` SQLite 表 + 迁移 |
| 7 | 扩展 `preload.ts` + `ipcBridge.ts` |
| 8 | 实现 `mcpStore.ts` |
| 9 | 实现 Server 管理页面（列表 + 编辑 + 连接状态） |
| 10 | 实现工具列表 + 测试面板 |
| 11 | 集成到 AI 对话：工具注入 + tool_call 处理 |
| 12 | 实现 JSON Schema → Form 自动渲染 |

---

## 五、实施优先级与依赖关系

```
文件处理 ──────────────────┐
                           ├──→ Prompt 模板库 ──→ Skill 管理 ──→ MCP 管理
SQLite 基础设施（已完成）──┘      ↑                  ↑              ↑
                                 │                  │              │
                           变量插值引擎      MCP 工具绑定     @modelcontextprotocol/sdk
```

**推荐实施顺序：**

| 优先级 | 模块 | 理由 |
|--------|------|------|
| P0 | 文件处理 | 对话基础能力，用户体验刚需 |
| P1 | Prompt 模板库 | 独立模块，无外部依赖，快速交付 |
| P2 | Skill 管理 | 依赖 Prompt 模板 + 模型配置（已有） |
| P3 | MCP 管理 | 最复杂，依赖外部 SDK，可作为高级功能 |

**预估工时：**

| 模块 | 预估 |
|------|------|
| 文件处理 | 8-10h |
| Prompt 模板库 | 10-12h |
| Skill 管理 | 10-12h |
| MCP 管理 | 14-16h |
| **合计** | **42-50h** |
