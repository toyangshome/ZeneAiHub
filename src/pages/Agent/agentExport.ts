import type { AgentContentBlock } from '@shared/types/agent';

interface ExportMessage {
  role: 'user' | 'assistant';
  blocks: AgentContentBlock[];
  createdAt: number;
  cost?: number;
}

interface SessionMeta {
  title: string;
  projectPath: string;
  model: string | null;
  createdAt: number;
}

/** 将 Agent 会话导出为 Markdown 文本 */
export function agentSessionToMarkdown(meta: SessionMeta, messages: ExportMessage[]): string {
  const lines: string[] = [];

  // 会话头部
  lines.push(`# ${meta.title || 'Agent 会话'}`);
  lines.push('');
  lines.push(`- **项目路径**: \`${meta.projectPath}\``);
  if (meta.model) lines.push(`- **模型**: ${meta.model}`);
  lines.push(`- **时间**: ${new Date(meta.createdAt).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of messages) {
    const timeStr = new Date(msg.createdAt).toLocaleTimeString();

    if (msg.role === 'user') {
      lines.push(`## User (${timeStr})`);
      lines.push('');
      for (const block of msg.blocks) {
        if (block.type === 'text') {
          lines.push(block.text);
          lines.push('');
        }
      }
    } else {
      // Assistant
      const hasThinking = msg.blocks.some((b) => b.type === 'thinking');
      const hasTools = msg.blocks.some((b) => b.type === 'tool_use');
      const hasText = msg.blocks.some((b) => b.type === 'text');

      lines.push(`## Assistant (${timeStr})`);
      lines.push('');

      for (const block of msg.blocks) {
        switch (block.type) {
          case 'thinking':
            lines.push('> **Thinking**');
            lines.push('>');
            for (const line of block.thinking.split('\n')) {
              lines.push(`> ${line}`);
            }
            lines.push('');
            break;

          case 'tool_use':
            lines.push(`### Tool: \`${block.name}\``);
            lines.push('');
            lines.push('**Parameters:**');
            lines.push('');
            lines.push('```json');
            lines.push(JSON.stringify(block.input, null, 2));
            lines.push('```');
            lines.push('');
            break;

          case 'tool_result': {
            const isError = block.is_error ? ' (Error)' : '';
            lines.push(`**Result${isError}:**`);
            lines.push('');
            const content = block.content || '';
            // 检测是否是代码/命令输出，用代码块包裹
            if (content.includes('\n') || looksLikeCode(content)) {
              lines.push('```');
              lines.push(content);
              lines.push('```');
            } else {
              lines.push(content);
            }
            lines.push('');
            break;
          }

          case 'text':
            lines.push(block.text);
            lines.push('');
            break;
        }
      }

      if (msg.cost && msg.cost > 0) {
        lines.push(`---`);
        lines.push(`*Cost: $${msg.cost.toFixed(4)}*`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function looksLikeCode(text: string): boolean {
  // 简单启发：含缩进、花括号、分号等常见代码特征
  return /^\s+(const|let|var|function|class|import|export|if|for|return|{|\[)/m.test(text)
    || /[{};]/.test(text);
}
