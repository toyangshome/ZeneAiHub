<!-- markdownlint-disable MD033 MD041 -->
<div align="center">
  <img src="resources/icon.png" alt="ZeneAIHub Logo" width="120" height="120" />

  <h1>ZeneAIHub</h1>

  <p>
    <strong>下一代桌面 AI 助手平台 — 将多模型对话、Claude Code Agent、MCP 集成融为一体</strong>
  </p>

  <p>
    <a href="https://github.com/toyangshome/ZeneAiHub/releases/latest"><img src="https://img.shields.io/badge/下载-最新版-blue?style=for-the-badge&logo=github" alt="下载最新版" /></a>
    <img src="https://img.shields.io/github/license/toyangshome/ZeneAiHub?style=for-the-badge" alt="License" />
    <img src="https://img.shields.io/github/stars/toyangshome/ZeneAiHub?style=for-the-badge&color=gold" alt="Stars" />
  </p>

  <p>
    <img src="https://img.shields.io/badge/Electron-35-47848F?style=flat-square&logo=electron&logoColor=white" alt="Electron" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Zustand-5-443E38?style=flat-square&logo=data:image/svg+xml" alt="Zustand" />
  </p>

  <br />

  [English](./README.en.md) | 简体中文

</div>

---

## 核心特性

### 多模型对话

- 支持 **OpenAI**、**Anthropic**、**DeepSeek** 等多家 AI 服务商
- 一个界面管理多个模型，自由切换
- 一键测试模型连通性，延迟一目了然
- Thinking 模式支持，深入推理不再有黑盒
- 完整的 Markdown 渲染：代码高亮、LaTeX 数学公式、表格、GFM

### Claude Code Agent

- 内置 **Claude Code CLI**，桌面端直接操作代码仓库
- 四种权限模式自由切换：
  - `Default` — 保守模式，关键操作需确认
  - `Auto-edit` — 自动编辑，其余确认
  - `Plan` — 先规划再执行
  - `Bypass` — 完全信任，极速执行
- 工具调用可视化：文件 Diff 对比、命令执行、代码搜索一目了然
- 会话持久化 — 关闭再打开，上下文仍在
- 对话导出 — 将 Agent 会话导出为文件归档

### 提示词 & 技能管理

- 内置 **提示词模板** 管理，常用 Prompt 随取随用
- **Skills 技能系统** — 可复用的 AI 工作流
- 支持变量插值，模板动态化

### MCP 协议集成

- 原生支持 **Model Context Protocol (MCP)**
- 通过 MCP 扩展 AI 能力边界，连接外部工具和服务

### 丰富文件处理

- 上传并分析 PDF、Word、Excel 等多种格式
- AI 直接读取文件内容进行问答和分析

---

## 截图

> **TODO** — 欢迎提交 PR 添加截图！运行项目后截图放入 `docs/screenshots/` 目录即可。

---

## 快速开始

### 环境要求

| 依赖 | 最低版本 |
|------|---------|
| Node.js | `>= 20` |
| pnpm | `>= 9` |

### 安装 & 运行

```bash
# 克隆仓库
git clone https://github.com/toyangshome/ZeneAiHub.git
cd ZeneAiHub

# 安装依赖
pnpm install

# 开发模式启动
pnpm dev
```

### 构建安装包

```bash
# Windows
pnpm dist:win

# macOS
pnpm dist:mac

# Linux
pnpm dist:linux
```

构建产物输出至 `release/` 目录。

---

## 架构概览

```
ZeneAIHub
├── electron/                 # 主进程
│   ├── ipc/                  # IPC 通信处理器
│   ├── services/
│   │   ├── ai/               # AI 服务商抽象层（OpenAI / Anthropic / ...）
│   │   ├── agent/            # Claude Code Agent 服务
│   │   ├── mcp/              # MCP 协议实现
│   │   ├── file/             # 文件处理（PDF / DOCX / XLSX）
│   │   └── storage/          # SQLite 数据库 + 迁移
│   └── main.cjs              # 主进程入口
│
├── src/                      # 渲染进程
│   ├── pages/
│   │   ├── Chat/             # 多模型对话
│   │   ├── Agent/            # Claude Code Agent
│   │   ├── Prompts/          # 提示词模板
│   │   ├── Skills/           # 技能管理
│   │   ├── MCP/              # MCP 集成
│   │   └── Settings/         # 设置
│   ├── stores/               # Zustand 状态管理
│   ├── hooks/                # 自定义 Hooks
│   ├── services/             # IPC Bridge
│   └── components/           # 公共组件
│
├── shared/                   # 渲染进程 & 主进程共享类型
└── resources/                # 应用图标 & 资源
```

---

## 技术栈

<table>
  <tr>
    <td align="center" width="120"><b>层</b></td>
    <td><b>技术选型</b></td>
  </tr>
  <tr>
    <td>桌面框架</td>
    <td>Electron 35 + electron-builder（NSIS / DMG / AppImage）</td>
  </tr>
  <tr>
    <td>前端</td>
    <td>React 19 + TypeScript 5.8 + Vite 6</td>
  </tr>
  <tr>
    <td>UI 库</td>
    <td>Ant Design 5.x + Ant Design X + Tailwind CSS 4</td>
  </tr>
  <tr>
    <td>状态管理</td>
    <td>Zustand 5</td>
  </tr>
  <tr>
    <td>数据库</td>
    <td>better-sqlite3（本地嵌入式）</td>
  </tr>
  <tr>
    <td>AI 集成</td>
    <td>Anthropic SDK + Claude Code CLI + MCP SDK</td>
  </tr>
  <tr>
    <td>Markdown</td>
    <td>react-markdown + rehype-highlight + rehype-katex + remark-gfm</td>
  </tr>
  <tr>
    <td>代码质量</td>
    <td>ESLint + Prettier + Husky + lint-staged</td>
  </tr>
</table>

---

## 配置指南

### 添加 AI 模型

1. 打开 **设置 → 模型管理**
2. 点击 **添加模型**，选择服务商（OpenAI / Anthropic / DeepSeek / ...）
3. 填入 API Key、Base URL（可选）、模型名称
4. 点击 **测试** 验证连通性

### Claude Code Agent

1. 打开 **设置 → Claude Code**
2. 填入 API Key 和可选的代理 Base URL
3. 支持自定义模型映射（Opus / Sonnet 4 / Sonnet 3.7 / Haiku）
4. 进入 **Agent** 页面即可使用

### MCP 集成

1. 打开 **MCP** 页面
2. 添加 MCP Server 配置
3. AI 模型将自动获得 MCP 提供的工具能力

---

## 开发命令

```bash
pnpm dev              # 启动开发模式（主进程 + 渲染进程）
pnpm dev:renderer     # 仅启动 Vite 渲染进程
pnpm build            # 构建全部
pnpm typecheck        # TypeScript 类型检查
pnpm lint             # ESLint 检查
pnpm format           # Prettier 格式化
pnpm dist:win         # 打包 Windows 安装包
pnpm dist:mac         # 打包 macOS 安装包
pnpm dist:linux       # 打包 Linux 安装包
```

---

## 项目状态

> **活跃开发中** — ZeneAIHub 正在快速迭代。Agent、MCP 等功能会持续增强。
> 欢迎提 Issue 和 PR！

### 近期更新

- **Claude Code Agent** — 内置 CLI、权限模式、工具审批、Diff 可视化、会话持久化
- **对话导出** — 将 Agent 会话导出为文件
- **MCP 协议支持** — 连接外部工具生态
- **Thinking 模式** — 支持 AI 深度推理

---

## 贡献

欢迎任何形式的贡献！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feat/amazing-feature`
5. 提交 Pull Request

---

## 许可证

本项目采用 [MIT](LICENSE) 许可证。

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/toyangshome">ZeneWork</a></sub>
</div>
