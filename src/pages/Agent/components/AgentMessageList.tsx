import { useState, memo } from 'react';
import { Typography, Tag, theme } from 'antd';
import {
  ApiOutlined, CloseCircleOutlined,
  CheckCircleOutlined, CloseCircleOutlined as CloseIcon,
  BulbOutlined, LoadingOutlined, DownOutlined, RightOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';
import { useAutoScroll } from '../../Chat/hooks/useAutoScroll';
import { MarkdownRenderer } from '../../Chat/components/MarkdownRenderer';
import { DiffBlock } from './DiffBlock';
import { TOOL_META, getToolPreview } from '../agentToolMeta';
import type { AgentContentBlock, AgentMessage, AgentToolUseBlock, AgentToolResultBlock } from '@shared/types/agent';

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

// 将 blocks 解析为结构化段落
interface ThinkingSegment { type: 'thinking'; text: string }
interface ToolSegment { type: 'tool'; toolUse: AgentToolUseBlock; result?: AgentToolResultBlock }
interface TextSegment { type: 'text'; text: string }
type Segment = ThinkingSegment | ToolSegment | TextSegment;

function parseSegments(blocks: AgentContentBlock[]): Segment[] {
  const resultMap = new Map<string, AgentToolResultBlock>();
  const segments: Segment[] = [];

  for (const b of blocks) {
    if (b.type === 'tool_result') {
      resultMap.set(b.tool_use_id, b);
    }
  }

  for (const b of blocks) {
    if (b.type === 'thinking') {
      segments.push({ type: 'thinking', text: b.thinking });
    } else if (b.type === 'tool_use') {
      segments.push({ type: 'tool', toolUse: b, result: resultMap.get(b.id) });
    } else if (b.type === 'text') {
      segments.push({ type: 'text', text: b.text });
    }
    // tool_result 已被合并到 tool 段，跳过
  }

  return segments;
}

// ========== 主组件 ==========

export function AgentMessageList() {
  const messages = useAgentStore((s) => s.messages);
  const status = useAgentStore((s) => s.status);
  const error = useAgentStore((s) => s.error);
  const { containerRef } = useAutoScroll(messages.length, status);

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
      {messages.length === 0 && !error ? (
        <EmptyState />
      ) : (
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((msg) => (
            <AgentMessageBubble key={msg.id} message={msg} />
          ))}
          {status === 'running' && <ThinkingIndicator />}
          {status === 'error' && error && <ErrorBanner message={error} />}
        </div>
      )}
    </div>
  );
}

// ========== 消息气泡 ==========

const AgentMessageBubble = memo(function AgentMessageBubble({ message }: { message: AgentMessage }) {
  const { token } = theme.useToken();
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '70%', padding: '10px 16px', borderRadius: 16,
          background: token.colorPrimary, color: token.colorWhite,
          fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word',
        }}>
          {(message.blocks[0] as { text?: string })?.text || ''}
        </div>
      </div>
    );
  }

  const segments = parseSegments(message.blocks);
  const hasThinking = segments.some((s) => s.type === 'thinking');
  const toolSegments = segments.filter((s): s is ToolSegment => s.type === 'tool');
  const textSegments = segments.filter((s): s is TextSegment => s.type === 'text');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '4px 0',
    }}>
      {/* 思考指示器 */}
      {hasThinking && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, color: token.colorTextQuaternary,
        }}>
          <BulbOutlined style={{ fontSize: 12 }} />
          <span>已思考</span>
        </div>
      )}

      {/* 工具调用步骤列表 */}
      {toolSegments.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          borderRadius: 10, overflow: 'hidden',
          border: `1px solid ${token.colorBorderSecondary}`,
        }}>
          {toolSegments.map((seg, i) => (
            <ToolStepRow key={`${seg.toolUse.id}-${i}`} segment={seg} token={token} isLast={i === toolSegments.length - 1} />
          ))}
        </div>
      )}

      {/* 回复文本 */}
      {textSegments.length > 0 && (
        <div style={{
          fontSize: 14, lineHeight: 1.7, wordBreak: 'break-word',
          padding: '2px 0',
        }}>
          {textSegments.map((seg, i) => (
            <MarkdownRenderer key={i} content={seg.text} />
          ))}
        </div>
      )}

      {/* 费用/耗时 */}
      {message.cost !== undefined && message.cost > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Tag style={{ fontSize: 11, borderRadius: 8, margin: 0 }}>${message.cost.toFixed(4)}</Tag>
          {message.durationMs && message.durationMs > 0 && (
            <Tag style={{ fontSize: 11, borderRadius: 8, margin: 0 }}>{(message.durationMs / 1000).toFixed(1)}s</Tag>
          )}
        </div>
      )}
    </div>
  );
});

// ========== 工具步骤行 ==========

function ToolStepRow({ segment, token, isLast }: { segment: ToolSegment; token: ReturnType<typeof theme.useToken>['token']; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { toolUse, result } = segment;
  const meta = TOOL_META[toolUse.name];
  const accentColor = meta?.color || token.colorTextSecondary;
  const preview = getToolPreview(toolUse.name, toolUse.input);
  const done = !!result;
  const isError = result?.is_error;
  const resultContent = result?.content || '';
  const isDiffTool = toolUse.name === 'Edit' || toolUse.name === 'Write';
  const canExpand = done && (resultContent || isDiffTool);

  return (
    <div style={{
      background: token.colorBgTextHover,
      borderBottom: isLast ? 'none' : `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div
        onClick={() => canExpand && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', cursor: canExpand ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {/* 状态图标 */}
        {!done ? (
          <LoadingOutlined style={{ color: token.colorPrimary, fontSize: 13, flexShrink: 0 }} />
        ) : isError ? (
          <CloseIcon style={{ color: token.colorError, fontSize: 13, flexShrink: 0 }} />
        ) : (
          <CheckCircleOutlined style={{ color: token.colorSuccess, fontSize: 13, flexShrink: 0 }} />
        )}

        {/* 工具标签 */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 12, fontWeight: 500, color: accentColor, flexShrink: 0,
        }}>
          {meta?.icon || <ToolOutlined />}
          {toolUse.name}
        </span>

        {/* 预览 */}
        <Typography.Text type="secondary" style={{ fontSize: 12, flex: 1, minWidth: 0 }} ellipsis>
          {preview}
        </Typography.Text>

        {/* 结果摘要 / 执行中 */}
        {!done && (
          <Tag color="processing" style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0 }}>
            执行中
          </Tag>
        )}
        {done && resultContent && (
          <span style={{
            fontSize: 11, color: isError ? token.colorError : token.colorTextQuaternary,
            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flexShrink: 1,
          }}>
            {truncate(resultContent, 40)}
          </span>
        )}

        {/* 展开箭头 */}
        {canExpand && (
          <span style={{ color: token.colorTextQuaternary, fontSize: 10, flexShrink: 0 }}>
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        )}
      </div>

      {/* 展开的完整结果 / Diff 视图 */}
      {expanded && done && (
        <div style={{ padding: '4px 12px 8px 33px' }}>
          {toolUse.name === 'Edit' && toolUse.input.old_string !== undefined ? (
            <DiffBlock
              filePath={String(toolUse.input.file_path || '')}
              oldContent={String(toolUse.input.old_string)}
              newContent={String(toolUse.input.new_string || '')}
            />
          ) : toolUse.name === 'Write' && toolUse.input.content !== undefined ? (
            <DiffBlock
              filePath={String(toolUse.input.file_path || '')}
              oldContent=""
              newContent={String(toolUse.input.content)}
            />
          ) : resultContent ? (
            <div style={{
              fontSize: 12, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 300, overflow: 'auto',
              color: token.colorTextSecondary,
            }}>
              {resultContent}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const { token } = theme.useToken();
  const cliAvailable = useAgentStore((s) => s.cliAvailable);
  const cliCheckError = useAgentStore((s) => s.cliCheckError);
  const cwd = useAgentStore((s) => s.cwd);

  if (!cliAvailable) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: token.colorErrorBg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          <ApiOutlined style={{ color: token.colorError }} />
        </div>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Claude CLI 未安装
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13, textAlign: 'center', maxWidth: 360 }}>
          {cliCheckError || '内置 Claude CLI 不可用'}
          <br />
          请前往「设置 → Claude Code」检查配置
        </Typography.Text>
      </div>
    );
  }

  if (!cwd) {
    return (
      <div style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: token.colorPrimaryBg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 32,
        }}>
          <ApiOutlined style={{ color: token.colorPrimary }} />
        </div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          开始 Agent 会话
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 14, textAlign: 'center', maxWidth: 400 }}>
          点击下方「选择项目」按钮，指定工作目录后<br />
          输入指令，AI 将自主完成编程任务
        </Typography.Text>
      </div>
    );
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: token.colorPrimaryBg, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 32,
      }}>
        <ApiOutlined style={{ color: token.colorPrimary }} />
      </div>
      <Typography.Title level={4} style={{ margin: 0 }}>
        准备就绪
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 14 }}>
        在下方输入框中描述你的任务
      </Typography.Text>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 500 }}>
        {['帮我重构这个模块', '列出当前目录文件', '修复测试失败的 bug', '生成单元测试'].map((hint) => (
          <Tag key={hint} style={{
            cursor: 'default', borderRadius: 12, padding: '4px 12px', fontSize: 13,
            background: token.colorBgTextHover, border: 'none',
          }}>
            {hint}
          </Tag>
        ))}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  const { token } = theme.useToken();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
      color: token.colorTextTertiary, fontSize: 13,
    }}>
      <span className="agent-thinking-dots">
        <span /><span /><span />
      </span>
      Agent 正在思考和执行...
    </div>
  );
}

function ErrorBanner({ message: errorMsg }: { message: string }) {
  const { token } = theme.useToken();
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 14px', borderRadius: 12,
      background: token.colorErrorBg, border: `1px solid ${token.colorErrorBorder}`,
      fontSize: 13, lineHeight: 1.6, color: token.colorError,
    }}>
      <CloseCircleOutlined style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {errorMsg}
      </div>
    </div>
  );
}
