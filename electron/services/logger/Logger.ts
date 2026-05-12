import fs from 'fs';
import path from 'path';
import { app } from 'electron';

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

class Logger {
  private logDir: string;
  private maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFile(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${date}.log`);
  }

  private write(level: LogLevel, module: string, message: string, error?: unknown): void {
    const timestamp = new Date().toISOString();
    const errorMsg = error instanceof Error ? `\n  ${error.stack || error.message}` : '';
    const line = `[${timestamp}] [${level}] [${module}] ${message}${errorMsg}\n`;

    // 控制台输出（开发环境全输出，生产环境 INFO+）
    const isDev = !app.isPackaged;
    if (isDev || level !== 'DEBUG') {
      const consoleFn = level === 'ERROR' ? console.error
        : level === 'WARN' ? console.warn
        : console.log;
      consoleFn(line.trimEnd());
    }

    // 写入文件
    try {
      const logFile = this.getLogFile();
      fs.appendFileSync(logFile, line, 'utf-8');
    } catch {
      // 日志写入失败不抛异常
    }
  }

  error(module: string, message: string, error?: unknown): void {
    this.write('ERROR', module, message, error);
  }

  warn(module: string, message: string): void {
    this.write('WARN', module, message);
  }

  info(module: string, message: string): void {
    this.write('INFO', module, message);
  }

  debug(module: string, message: string): void {
    this.write('DEBUG', module, message);
  }
}

export const logger = new Logger();
