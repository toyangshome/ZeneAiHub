import type { ReactNode } from 'react';
import {
  ReadOutlined, EditOutlined, FileAddOutlined,
  CodeOutlined, SearchOutlined, GlobalOutlined, ToolOutlined,
} from '@ant-design/icons';

export interface ToolMeta {
  icon: ReactNode;
  color: string;
  risk: string;
}

export const TOOL_META: Record<string, ToolMeta> = {
  Read:     { icon: <ReadOutlined />,     color: '#3b82f6', risk: '读取文件内容' },
  Edit:     { icon: <EditOutlined />,     color: '#f59e0b', risk: '修改文件内容' },
  Write:    { icon: <FileAddOutlined />,  color: '#10b981', risk: '创建或覆写文件' },
  Bash:     { icon: <CodeOutlined />,     color: '#8b5cf6', risk: '执行系统命令' },
  Glob:     { icon: <SearchOutlined />,   color: '#6366f1', risk: '搜索文件路径' },
  Grep:     { icon: <SearchOutlined />,   color: '#ec4899', risk: '搜索文件内容' },
  WebFetch: { icon: <GlobalOutlined />,   color: '#06b6d4', risk: '获取网页内容' },
  WebSearch:{ icon: <GlobalOutlined />,   color: '#0ea5e9', risk: '搜索互联网' },
};

/** 从工具输入中提取简短预览 */
export function getToolPreview(name: string, input: Record<string, unknown>): string {
  if (input.file_path) return String(input.file_path).split(/[/\\]/).pop() || '';
  if (input.command) return String(input.command).slice(0, 60);
  if (input.pattern) return String(input.pattern);
  if (input.query) return String(input.query).slice(0, 40);
  if (input.url) return String(input.url).slice(0, 50);
  return name;
}

/** 从工具输入中提取详细信息（用于审批弹窗） */
export function getToolDetail(input: Record<string, unknown>): string {
  if (input.command) return String(input.command);
  if (input.file_path) return String(input.file_path);
  if (input.pattern) return String(input.pattern);
  if (input.query) return String(input.query);
  if (input.url) return String(input.url);
  if (input.new_string) return String(input.new_string).slice(0, 200);
  return JSON.stringify(input, null, 2).slice(0, 300);
}
