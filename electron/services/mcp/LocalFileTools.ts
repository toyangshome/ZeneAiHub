import fs from 'fs';
import path from 'path';
import os from 'os';
import type { MCPTool, MCPToolResult } from '@shared/types';
import { logger } from '../logger/Logger';

const HOME = os.homedir();

/** 安全检查：确保路径在允许范围内 */
function validatePath(filePath: string): string {
  const resolved = path.resolve(filePath);
  // 禁止访问系统敏感目录
  const blocked = [path.resolve('/etc'), path.resolve('C:\\Windows'), path.resolve('C:\\Program Files')];
  if (blocked.some((b) => resolved.startsWith(b))) {
    throw new Error(`不允许访问系统目录: ${resolved}`);
  }
  return resolved;
}

export const localFileTools: Omit<MCPTool, 'serverId'>[] = [
  {
    name: 'read_file',
    description: '读取文件内容。支持文本文件，返回文件内容字符串。',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件的绝对路径或相对于用户目录的路径' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: '写入内容到文件。如果文件不存在会自动创建，如果目录不存在也会自动创建。',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件的绝对路径或相对于用户目录的路径' },
        content: { type: 'string', description: '要写入的文件内容' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'create_directory',
    description: '创建目录（递归创建，类似 mkdir -p）。',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录的绝对路径或相对于用户目录的路径' },
      },
      required: ['path'],
    },
  },
];

/** 解析路径：支持绝对路径和 ~ 开头的用户目录 */
function resolvePath(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(HOME, filePath.slice(1));
  }
  if (!path.isAbsolute(filePath)) {
    return path.join(HOME, filePath);
  }
  return filePath;
}

export async function handleLocalToolCall(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
  try {
    switch (toolName) {
      case 'read_file': {
        const filePath = validatePath(resolvePath(String(args.path)));
        if (!fs.existsSync(filePath)) {
          return { content: [{ type: 'text', text: `文件不存在: ${filePath}` }], isError: true };
        }
        const stat = fs.statSync(filePath);
        if (stat.size > 1024 * 1024) {
          return { content: [{ type: 'text', text: `文件过大 (${(stat.size / 1024).toFixed(0)} KB)，暂不支持读取超过 1MB 的文件` }], isError: true };
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        logger.info('LocalFileTools', `读取文件: ${filePath} (${content.length} 字符)`);
        return { content: [{ type: 'text', text: content }], isError: false };
      }

      case 'write_file': {
        const filePath = validatePath(resolvePath(String(args.path)));
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, String(args.content), 'utf-8');
        logger.info('LocalFileTools', `写入文件: ${filePath}`);
        return { content: [{ type: 'text', text: `文件已写入: ${filePath}` }], isError: false };
      }

      case 'create_directory': {
        const dirPath = validatePath(resolvePath(String(args.path)));
        fs.mkdirSync(dirPath, { recursive: true });
        logger.info('LocalFileTools', `创建目录: ${dirPath}`);
        return { content: [{ type: 'text', text: `目录已创建: ${dirPath}` }], isError: false };
      }

      default:
        return { content: [{ type: 'text', text: `未知工具: ${toolName}` }], isError: true };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('LocalFileTools', `工具 ${toolName} 执行失败`, err);
    return { content: [{ type: 'text', text: msg }], isError: true };
  }
}
