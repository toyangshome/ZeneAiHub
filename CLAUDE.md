# CLAUDE.md — ZeneAIHub 项目规范

## 语言偏好
- 始终使用中文进行对话和回复。

## 技术栈
- Electron 35 + React 19 + TypeScript 5.8 + Vite 6
- Ant Design 5.x + Ant Design X 1.x
- Zustand 状态管理 + SQLite (better-sqlite3)
- `"type": "module"` + Electron 主进程输出为 `.cjs`

## 编码规范

### antd 消息提示 — 禁止静态 API
antd v5 静态 `message.success()`/`message.error()` 不兼容 React 19，必须使用上下文版本：
```tsx
import { App } from 'antd';
// 组件内部：
const { message } = App.useApp();
message.success('操作成功');
```
App.tsx 中已用 `<AntdApp>` 包裹全局。

### 错误处理 — 所有异步操作必须 try/catch
- **Zustand Store action**：每个异步 action 必须有 try/catch，失败时设置 `error` 状态或 console.error
- **页面事件处理函数**（handleSave, handleDelete 等）：必须 try/catch + 用户友好错误提示 `message.error()`
- **Promise 链**：禁止 `.then()` 没有 `.catch()`，即使是 fire-and-forget 也要 `.catch(console.error)`
- **关键**：`sendMessage` 等涉及 streaming 状态的操作，catch 中必须重置 `streaming: false`，否则 UI 卡死

### 类型安全 — 消除 `as any`
- `ipcBridge.ts`：参数类型必须使用共享类型（`Message`, `StreamConfig`, `Conversation` 等），禁止 `any`
- SQLite Repository：`row` 参数使用具体类型或 `{ [key: string]: unknown }`，避免 `as any`
- Electron 特有属性（如 `file.path`）：声明扩展类型 `File & { path?: string }` 而非 `as any`
- 仅在 ESM/CJS 兼容层（如 `createRequire`）中允许 `as any`，并加注释说明原因

### IPC 通信
- 主进程 IPC handler 必须有 try/catch，返回结构化错误给渲染进程
- 不要直接暴露内部异常信息给渲染进程
- 渲染进程通过 `api` 对象调用，不要直接调用 `window.electronAPI`

### 资源管理
- 事件监听器/订阅：必须在 cleanup 函数中移除
- fetch + ReadableStream reader：disconnect 时必须 `reader.cancel()` + `abortController.abort()`
- 防止重复注册：全局初始化函数使用 guard flag（如 `_themeInitialized`）
- 进程/subprocess：kill 时设置为 null

### 配置读取 — 禁止硬编码
- 模型配置（provider, model, baseUrl, temperature 等）必须从 modelStore 读取
- API URL 使用配置中的 baseUrl，fallback 默认值仅在 Provider 实现中允许
- 模板/Skill 默认值在表单初始化时设置，不要在业务逻辑中硬编码

### 文件结构
```
src/stores/       — Zustand store，每个 store 管理一个领域状态
src/pages/        — 页面组件，CRUD 逻辑放 handle 函数中
src/services/     — IPC bridge 等服务层
src/hooks/        — 自定义 Hook
electron/ipc/     — IPC handler 注册
electron/services/ — 主进程业务逻辑
shared/types/     — 渲染进程和主进程共享的类型定义
```

### Upload/Attachments 组件 — 拦截默认上传
antd `Upload` 和 `@ant-design/x` `Attachments` 默认 POST 文件到服务器。Electron 本地应用必须拦截：
```tsx
<Attachments
  beforeUpload={(file) => { handleFile(file); return false; }} // 阻止 POST
  customRequest={({ onSuccess }) => { onSuccess?.('ok'); }}    // 空实现
  // ...
/>
```

### 常见错误模式（已修复，防止复发）
1. StreamConfig 硬编码 → 必须从 modelStore 读取模型配置
2. 静态 message API → 使用 App.useApp()
3. Store action 无 try/catch → 每个异步 action 包裹
4. IPC handler 无错误处理 → 主进程 handler 加 try/catch
5. SSE/Stream reader 未释放 → disconnect 时 cancel reader + abort controller
6. EventListener 重复注册 → 全局 guard flag
7. Upload 组件默认 POST → beforeUpload 返回 false + customRequest 空实现
8. CodeBlock 区分 inline/block → 无 `language-` className 时只渲染 `<code>`，不带复制按钮
9. 流式 thinking 块合并 → 相邻 `[THINKING]` 块直接拼接（不加换行），跳过中间空白文本

### react-markdown CodeBlock — 区分行内代码和代码块
```tsx
// MarkdownRenderer 中通过 className 判断
const codeComponent: Components['code'] = ({ className, children }) => {
  const isInline = !className?.startsWith('language-');
  return <CodeBlock className={className} inline={isInline}>{children}</CodeBlock>;
};
// CodeBlock 中 inline 时只渲染简单 <code>
if (inline) return <code style={{ background: '...' }}>{children}</code>;
```

### @ant-design/x Sender — actions render 函数
在发送按钮旁添加自定义按钮用 `actions` prop：
```tsx
<Sender actions={(oriNode) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    {oriNode}
    <Button type="primary" shape="circle" icon={<PlusOutlined />} />
  </div>
)} />
```
