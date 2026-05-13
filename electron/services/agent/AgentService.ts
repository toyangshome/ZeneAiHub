import { spawn, type ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import type { AgentStreamEvent } from '@shared/types/agent';

// ========== CLI 路径 ==========

function getCliPath(): string {
  const { join } = require('path');
  // 尝试多个候选路径
  const candidates = [
    join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    join(process.cwd(), 'node_modules', '.pnpm', '@anthropic-ai+claude-code@2.1.139', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
  ];
  const { existsSync } = require('fs');
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0]; // fallback，后续会报错
}

// ========== 类型 ==========

interface SessionContext {
  sessionId: string;
  process: ChildProcess;
  cwd: string;
  status: 'running' | 'idle' | 'stopped' | 'error';
  stdoutBuffer: string;
  sender: Electron.WebContents;
}

interface SessionConfig {
  cwd: string;
  message: string;
  sessionId?: string; // 传入已有 session-id 以恢复会话
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  permissionMode?: string;
  tools?: string[];
  maxTurns?: number;
  maxBudgetUsd?: number;
}

// ========== 工具函数 ==========

function safeSend(sender: Electron.WebContents, channel: string, ...args: unknown[]) {
  if (!sender.isDestroyed()) {
    sender.send(channel, ...args);
  }
}

// ========== Agent 服务 ==========

class AgentService {
  private sessions = new Map<string, SessionContext>();

  /**
   * 创建新会话并发送第一条消息
   * 使用 --input-format stream-json --output-format stream-json 双向协议
   */
  startSession(config: SessionConfig, sender: Electron.WebContents): string {
    // 复用已有 session-id 或创建新的
    const sessionId = config.sessionId || uuidv4();
    const cliPath = getCliPath();

    console.log(`[Agent] 创建会话 ${sessionId.slice(0, 8)} cwd=${config.cwd}`);

    // 构建 CLI 参数
    const args: string[] = [
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--session-id', sessionId,
      '--no-session-persistence',
      '--permission-mode', config.permissionMode || 'default',
    ];

    if (config.model) {
      args.push('--model', config.model);
    }
    if (config.maxTurns) {
      args.push('--max-turns', String(config.maxTurns));
    }
    if (config.maxBudgetUsd) {
      args.push('--max-budget-usd', String(config.maxBudgetUsd));
    }
    if (config.tools && config.tools.length > 0) {
      args.push('--tools', config.tools.join(','));
    }

    // 环境变量：API key 和 base URL
    const env: Record<string, string | undefined> = { ...process.env };
    if (config.apiKey) env.ANTHROPIC_API_KEY = config.apiKey;
    if (config.baseUrl) env.ANTHROPIC_BASE_URL = config.baseUrl;

    const proc = spawn(cliPath, args, {
      cwd: config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr 全部 pipe
      env,
    });

    const ctx: SessionContext = {
      sessionId,
      process: proc,
      cwd: config.cwd,
      status: 'running',
      stdoutBuffer: '',
      sender,
    };
    this.sessions.set(sessionId, ctx);

    // ========== stdout 事件解析 ==========
    proc.stdout.setEncoding('utf-8');
    proc.stdout.on('data', (chunk: string) => {
      ctx.stdoutBuffer += chunk;
      const lines = ctx.stdoutBuffer.split('\n');
      ctx.stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event: AgentStreamEvent = JSON.parse(trimmed);

          if (event.type === 'result') {
            ctx.status = 'idle';
          }

          safeSend(sender, `agent:session:stream:${sessionId}`, event);
        } catch {
          console.warn(`[Agent 非JSON ${sessionId.slice(0, 8)}]`, trimmed.slice(0, 300));
        }
      }
    });

    // ========== stderr 日志 ==========
    proc.stderr.setEncoding('utf-8');
    proc.stderr.on('data', (text: string) => {
      const trimmed = text.trim();
      if (trimmed) console.warn(`[Agent stderr ${sessionId.slice(0, 8)}]`, trimmed.slice(0, 300));
    });

    // ========== 进程退出 ==========
    proc.on('close', (code) => {
      console.log(`[Agent] 会话 ${sessionId.slice(0, 8)} 进程退出 code=${code}`);
      ctx.status = code === 0 ? 'stopped' : 'error';
      if (code !== 0 && code !== null) {
        safeSend(sender, `agent:session:error:${sessionId}`, `进程异常退出 (code: ${code})`);
      }
      // 解析 stdout 残留数据
      if (ctx.stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(ctx.stdoutBuffer.trim());
          safeSend(sender, `agent:session:stream:${sessionId}`, event);
        } catch { /* ignore */ }
      }
      // 通知前端会话结束
      safeSend(sender, `agent:session:done:${sessionId}`);
      this.sessions.delete(sessionId);
    });

    proc.on('error', (err) => {
      ctx.status = 'error';
      safeSend(sender, `agent:session:error:${sessionId}`, err.message);
      this.sessions.delete(sessionId);
    });

    // ========== 发送第一条消息 ==========
    this.writeMessage(sessionId, config.message);

    return sessionId;
  }

  /**
   * 向已有会话发送消息
   */
  sendMessage(sessionId: string, content: string): boolean {
    return this.writeMessage(sessionId, content);
  }

  /**
   * 向 CLI 发送权限审批响应
   */
  sendPermissionResponse(sessionId: string, toolUseId: string, approved: boolean): boolean {
    const ctx = this.sessions.get(sessionId);
    if (!ctx || ctx.process.stdin?.destroyed) return false;

    const payload = JSON.stringify({
      type: 'permission_response',
      tool_use_id: toolUseId,
      approved,
    });

    try {
      ctx.process.stdin!.write(payload + '\n');
      return true;
    } catch (err) {
      console.error('[Agent] sendPermissionResponse 失败:', err);
      return false;
    }
  }

  /**
   * 向 stdin 写入用户消息
   */
  private writeMessage(sessionId: string, content: string): boolean {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) {
      console.warn(`[Agent] writeMessage: 会话 ${sessionId.slice(0, 8)} 不存在`);
      return false;
    }
    if (ctx.process.stdin?.destroyed) {
      console.warn(`[Agent] writeMessage: 会话 ${sessionId.slice(0, 8)} stdin 已关闭`);
      return false;
    }

    const payload = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: content }],
      },
    });

    try {
      ctx.process.stdin!.write(payload + '\n');
      return true;
    } catch (err) {
      console.error(`[Agent] writeMessage 失败:`, err);
      return false;
    }
  }

  /**
   * 停止会话
   */
  stopSession(sessionId: string): void {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) return;

    console.log(`[Agent] 停止会话 ${sessionId.slice(0, 8)}`);
    try {
      ctx.process.stdin?.end();
    } catch { /* ignore */ }

    // 给进程 3 秒自行退出，超时后强制 kill
    const timer = setTimeout(() => {
      if (!ctx.process.killed) {
        try { ctx.process.kill(); } catch { /* ignore */ }
      }
    }, 3000);

    ctx.process.on('close', () => clearTimeout(timer));
    this.sessions.delete(sessionId);
  }

  getSessionStatus(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.status || null;
  }

  getSessionCwd(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.cwd || null;
  }

  /** 检查 CLI 是否可用 */
  checkCli(): { available: boolean; path?: string; error?: string } {
    const cliPath = getCliPath();
    const { existsSync } = require('fs');
    if (existsSync(cliPath)) {
      return { available: true, path: cliPath };
    }
    return { available: false, error: 'Claude CLI 未找到，请检查安装' };
  }

  /** 异步获取版本号 */
  async getCliVersion(): Promise<string | undefined> {
    const cliPath = getCliPath();
    const { existsSync } = require('fs');
    if (!existsSync(cliPath)) return undefined;

    return new Promise((resolve) => {
      const proc = spawn(cliPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      let settled = false;
      const done = (version?: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(version);
      };
      proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      proc.on('close', () => {
        const match = output.match(/(\d+\.\d+\.\d+)/);
        done(match ? match[1] : output.trim() || undefined);
      });
      proc.on('error', () => done());
      const timer = setTimeout(() => { proc.kill(); done(); }, 5000);
    });
  }
}

export const agentService = new AgentService();
