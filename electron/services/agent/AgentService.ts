import { spawn, execSync, type ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import type { AgentStreamEvent, AgentSessionConfig, AgentSessionStatus } from '@shared/types/agent';
import { getBundledCliPath } from './CliChecker';

interface SessionContext {
  sessionId: string;
  process: ChildProcess;
  cwd: string;
  status: AgentSessionStatus;
  stdoutBuffer: string;
  stderrBuffer: string;
  sender: Electron.WebContents;
}

function safeSend(sender: Electron.WebContents, channel: string, ...args: unknown[]) {
  if (!sender.isDestroyed()) {
    sender.send(channel, ...args);
  }
}

function killProcess(proc: ChildProcess) {
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /PID ${proc.pid} /T /F`, { timeout: 5000 });
    } catch {
      proc.kill('SIGTERM');
    }
  } else {
    proc.kill('SIGTERM');
  }
}

class AgentService {
  private sessions = new Map<string, SessionContext>();

  startSession(config: AgentSessionConfig, sender: Electron.WebContents): string {
    const sessionId = uuidv4();
    console.log(`[Agent] 启动会话 ${sessionId.slice(0, 8)} resume=${config.resume?.slice(0, 8) || 'none'} tools=${config.allowedTools?.join(',') || 'none'}`);
    const args = ['--output-format', 'stream-json', '--verbose'];

    if (config.resume) {
      args.push('--resume', config.resume);
    }
    if (config.allowedTools) {
      args.push('--allowedTools', config.allowedTools.join(','));
    }
    if (config.maxTurns) {
      args.push('--max-turns', String(config.maxTurns));
    }
    if (config.model) {
      args.push('--model', config.model);
    }
    args.push('--print');

    if (config.message) {
      args.push(config.message);
    }

    const cliPath = getBundledCliPath();

    // 合并环境变量：配置值覆盖全局值，未配置则继承全局
    const env: Record<string, string | undefined> = { ...process.env };
    if (config.apiKey) env.ANTHROPIC_API_KEY = config.apiKey;
    if (config.baseUrl) env.ANTHROPIC_BASE_URL = config.baseUrl;

    const proc = spawn(cliPath, args, {
      cwd: config.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    const ctx: SessionContext = {
      sessionId,
      process: proc,
      cwd: config.cwd,
      status: 'running',
      stdoutBuffer: '',
      stderrBuffer: '',
      sender,
    };
    this.sessions.set(sessionId, ctx);

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
          // 错误且 result 为空时，用 stderr 补充错误信息
          if (event.type === 'result' && event.is_error && !event.result && ctx.stderrBuffer.trim()) {
            event.result = ctx.stderrBuffer.trim();
          }
          safeSend(sender, `agent:session:stream:${sessionId}`, event);

          if (event.type === 'result') {
            ctx.status = 'idle';
            safeSend(sender, `agent:session:done:${sessionId}`);
          }
        } catch {
          console.warn(`[Agent 非JSON ${sessionId.slice(0, 8)}]`, trimmed.slice(0, 500));
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      ctx.stderrBuffer += text;
      const trimmed = text.trim();
      if (trimmed) console.warn(`[Agent stderr ${sessionId.slice(0, 8)}]`, trimmed.slice(0, 500));
    });

    proc.on('close', (code) => {
      console.log(`[Agent] 会话 ${sessionId.slice(0, 8)} 进程退出 code=${code}`);
      ctx.status = code === 0 ? 'stopped' : 'error';
      if (code !== 0 && code !== null) {
        safeSend(sender, `agent:session:error:${sessionId}`, `进程异常退出 (code: ${code})`);
      }
      if (ctx.stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(ctx.stdoutBuffer.trim());
          safeSend(sender, `agent:session:stream:${sessionId}`, event);
        } catch { /* ignore */ }
      }
      // 安全网：如果进程退出时还没有 result 事件，通知前端结束
      if ((ctx.status as AgentSessionStatus) !== 'idle') {
        safeSend(sender, `agent:session:done:${sessionId}`);
      }
      this.sessions.delete(sessionId);
    });

    proc.on('error', (err) => {
      ctx.status = 'error';
      safeSend(sender, `agent:session:error:${sessionId}`, err.message);
      this.sessions.delete(sessionId);
    });

    return sessionId;
  }

  cancelCurrentTurn(sessionId: string): void {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) { console.log(`[Agent] cancel: 会话 ${sessionId.slice(0, 8)} 不存在`); return; }
    console.log(`[Agent] 取消会话 ${sessionId.slice(0, 8)}`);
    killProcess(ctx.process);
    this.sessions.delete(sessionId);
  }

  stopSession(sessionId: string): void {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) { console.log(`[Agent] stop: 会话 ${sessionId.slice(0, 8)} 不存在`); return; }
    console.log(`[Agent] 停止会话 ${sessionId.slice(0, 8)}`);
    killProcess(ctx.process);
    this.sessions.delete(sessionId);
  }

  getSessionCwd(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.cwd || null;
  }

  getSessionStatus(sessionId: string): AgentSessionStatus | null {
    return this.sessions.get(sessionId)?.status || null;
  }
}

export const agentService = new AgentService();
