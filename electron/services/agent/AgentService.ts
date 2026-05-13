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

    // 合并环境变量，注入 API key 和自定义 URL
    const env: Record<string, string | undefined> = { ...process.env };
    if (config.apiKey) {
      env.ANTHROPIC_API_KEY = config.apiKey;
    }
    if (config.baseUrl) {
      env.ANTHROPIC_BASE_URL = config.baseUrl;
    }

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
          safeSend(sender, `agent:session:stream:${sessionId}`, event);

          if (event.type === 'result') {
            ctx.status = 'idle';
            safeSend(sender, `agent:session:done:${sessionId}`);
          }
        } catch {
          console.warn('[Agent] 非 JSON 输出:', trimmed.slice(0, 200));
        }
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (!text) return;
      // Claude CLI 将进度信息也输出到 stderr，过滤已知的非错误信息
      const noisePatterns = [
        'Loaded local', 'Using', 'Authenticat', 'API Key',
        'Claude Code', 'version', 'node:', 'npm warn',
      ];
      const isNoise = noisePatterns.some(p => text.includes(p));
      if (!isNoise && !text.startsWith('npm')) {
        console.warn('[Agent stderr]', text.slice(0, 300));
      }
    });

    proc.on('close', (code) => {
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
      if (ctx.status !== 'idle') {
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
    if (!ctx) return;
    killProcess(ctx.process);
    this.sessions.delete(sessionId);
  }

  stopSession(sessionId: string): void {
    const ctx = this.sessions.get(sessionId);
    if (!ctx) return;
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
