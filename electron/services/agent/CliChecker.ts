import { existsSync } from 'fs';
import { join, dirname } from 'path';

export interface CliCheckResult {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

/** 获取内置 CLI 的绝对路径 */
export function getBundledCliPath(): string {
  const candidates = [
    join(process.cwd(), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    join(dirname(require.main?.filename || ''), '..', '..', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

// 缓存结果，避免重复 spawn 227MB 二进制文件
let _cached: CliCheckResult | null = null;

export function checkClaudeCli(): CliCheckResult {
  // 已缓存且可用 → 直接返回
  if (_cached?.available) return _cached;

  const cliPath = getBundledCliPath();
  if (!existsSync(cliPath)) {
    _cached = { available: false, error: '内置 Claude CLI 未找到，请检查安装' };
    return _cached;
  }

  // 文件存在即可用，版本号异步获取
  _cached = { available: true, path: cliPath };
  return _cached;
}

/** 异步获取版本号（仅用户手动触发时调用） */
export async function getCliVersion(): Promise<string | undefined> {
  // 已缓存版本号 → 直接返回
  if (_cached?.version) return _cached.version;

  const { spawn } = await import('child_process');
  const cliPath = getBundledCliPath();
  if (!existsSync(cliPath)) return undefined;

  return new Promise((resolve) => {
    const proc = spawn(cliPath, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let settled = false;
    const done = (version?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (version && _cached) {
        _cached.version = version;
      }
      resolve(version);
    };
    proc.stdout.on('data', (d: Buffer) => { output += d.toString(); });
    proc.on('close', () => {
      const match = output.match(/(\d+\.\d+\.\d+)/);
      done(match ? match[1] : output.trim() || undefined);
    });
    proc.on('error', () => done());
    // 5 秒超时
    const timer = setTimeout(() => { proc.kill(); done(); }, 5000);
  });
}
