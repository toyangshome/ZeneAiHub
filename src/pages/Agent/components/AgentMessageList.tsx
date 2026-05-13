import { Typography, Tag, theme } from 'antd';
import { ApiOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../../stores/agentStore';
import { useAutoScroll } from '../../Chat/hooks/useAutoScroll';
import { ThinkingBlock } from './blocks/ThinkingBlock';
import { ToolUseBlock } from './blocks/ToolUseBlock';
import { ToolResultBlock } from './blocks/ToolResultBlock';
import { TextBlock } from './blocks/TextBlock';
import type { AgentContentBlock, AgentMessage, AgentToolResultBlock } from '@shared/types/agent';

export function AgentMessageList() {
  const messages = useAgentStore((s) => s.messages);
  const status = useAgentStore((s) => s.status);
  const { containerRef } = useAutoScroll([messages.length, status]);

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {messages.map((msg) => (
            <AgentMessageBubble key={msg.id} message={msg} />
          ))}
          {status === 'running' && <ThinkingIndicator />}
        </div>
      )}
    </div>
  );
}

function AgentMessageBubble({ message }: { message: AgentMessage }) {
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

  // 收集已有结果的 tool_use id
  const resultMap = new Map<string, AgentToolResultBlock>();
  for (const b of message.blocks) {
    if (b.type === 'tool_result') {
      resultMap.set(b.tool_use_id, b);
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      background: token.colorBgTextHover,
      borderRadius: 16, padding: '12px 16px',
      border: `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {message.blocks.map((block, i) => (
          block.type === 'tool_result' ? null : (
            <AgentBlockRenderer
              key={`${message.id}-${i}`}
              block={block}
              hasResult={block.type === 'tool_use' ? resultMap.has(block.id) : undefined}
            />
          )
        ))}
      </div>
      {message.cost !== undefined && message.cost > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Tag style={{ fontSize: 11, borderRadius: 8 }}>${message.cost.toFixed(4)}</Tag>
          {message.durationMs > 0 && (
            <Tag style={{ fontSize: 11, borderRadius: 8 }}>{(message.durationMs / 1000).toFixed(1)}s</Tag>
          )}
          {message.numTurns && message.numTurns > 1 && (
            <Tag style={{ fontSize: 11, borderRadius: 8 }}>{message.numTurns} 轮</Tag>
          )}
        </div>
      )}
    </div>
  );
}

function AgentBlockRenderer({ block, hasResult }: { block: AgentContentBlock; hasResult?: boolean }) {
  switch (block.type) {
    case 'text':
      return <TextBlock text={block.text} />;
    case 'thinking':
      return <ThinkingBlock thinking={block.thinking} />;
    case 'tool_use':
      return <ToolUseBlock id={block.id} name={block.name} input={block.input} hasResult={hasResult} />;
    case 'tool_result':
      return <ToolResultBlock toolUseId={block.tool_use_id} content={block.content} is_error={block.is_error} />;
    default:
      return null;
  }
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
          background: 'var(--ant-color-error-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          <ApiOutlined style={{ color: 'var(--ant-color-error)' }} />
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
          background: 'var(--ant-color-primary-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 32,
        }}>
          <ApiOutlined style={{ color: 'var(--ant-color-primary)' }} />
        </div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          开始 Agent 会话
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 14, textAlign: 'center', maxWidth: 400 }}>
          点击右上角「选择项目」按钮，指定工作目录后<br />
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
        background: 'var(--ant-color-primary-bg)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 32,
      }}>
        <ApiOutlined style={{ color: 'var(--ant-color-primary)' }} />
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
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0',
      color: 'var(--ant-color-text-tertiary)', fontSize: 13,
    }}>
      <span className="agent-thinking-dots">
        <span /><span /><span />
      </span>
      Agent 正在思考和执行...
    </div>
  );
}
